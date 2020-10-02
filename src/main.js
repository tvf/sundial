import SunCalc from 'suncalc';

import { vec3, mat4 } from 'gl-matrix';

import { Mesh, initMeshBuffers } from 'webgl-obj-loader';

import * as shaders from './shaders';

import test_dial from './dial.obj';

var paraview_style_camera = {
    rotation: mat4.create(),
    translation: mat4.fromTranslation(
        mat4.create(),
        vec3.fromValues(0, 0, -20),
    ),
};

var last_mouse_position = [0, 0];
var mouse_is_down = false;
var middle_mouse_is_down = false;
var shift_is_down = false;
var dirty = true;

function mouse_based_orbit_camera() {
    const fieldOfView = (45 * Math.PI) / 180; // in radians
    const aspect = 640 / 480;
    const zNear = 4;
    const zFar = 500.0;
    const projectionMatrix = mat4.create();

    mat4.perspective(projectionMatrix, fieldOfView, aspect, zNear, zFar);

    // mat4.ortho(projectionMatrix, -19.2, 19.2, -10.8, 10.8, zNear, zFar);

    const modelViewMatrix = mat4.mul(
        mat4.create(),
        paraview_style_camera.translation,
        paraview_style_camera.rotation,
    );

    var world_to_clip = mat4.create();
    mat4.mul(world_to_clip, projectionMatrix, modelViewMatrix);
    var clip_to_world = mat4.create();
    mat4.invert(clip_to_world, world_to_clip);

    return { world_to_clip: world_to_clip, clip_to_world: clip_to_world };
}

function setup_camera_controls() {
    const canvas = document.querySelector('#gl_canvas');

    var handle_keydown = function (event) {
        if (event.keyCode === 16 || event.charCode === 16) {
            shift_is_down = true;
        }
    };

    var handle_keyup = function (event) {
        if (event.keyCode === 16 || event.charCode === 16) {
            shift_is_down = false;
        }
    };

    document.addEventListener('keydown', handle_keydown);
    document.addEventListener('keyup', handle_keyup);

    canvas.onmousedown = function (event) {
        if (event.button == 0) {
            mouse_is_down = true;
        }

        if (event.button == 1) {
            middle_mouse_is_down = true;
        }
    };

    canvas.onmouseup = function (event) {
        if (event.button == 0) {
            mouse_is_down = false;
        }

        if (event.button == 1) {
            middle_mouse_is_down = false;
        }
    };

    canvas.onmousemove = function (event) {
        const rect = canvas.getBoundingClientRect();

        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        const last_mouse_delta = [
            x - last_mouse_position[0],
            y - last_mouse_position[1],
        ];

        last_mouse_position = [x, y];

        if (!shift_is_down && mouse_is_down) {
            mat4.mul(
                paraview_style_camera.rotation,
                mat4.fromRotation(
                    mat4.create(),
                    (2 * 3.14159 * last_mouse_delta[1] * 0.5) / 360,
                    [1, 0, 0],
                ),
                paraview_style_camera.rotation,
            );

            mat4.mul(
                paraview_style_camera.rotation,
                mat4.fromRotation(
                    mat4.create(),
                    (2 * 3.14159 * last_mouse_delta[0] * 0.5) / 360,
                    [0, 1, 0],
                ),
                paraview_style_camera.rotation,
            );

            dirty = true;
        }

        if (middle_mouse_is_down || (shift_is_down && mouse_is_down)) {
            mat4.translate(
                paraview_style_camera.translation,
                paraview_style_camera.translation,
                [0.02 * last_mouse_delta[0], -0.02 * last_mouse_delta[1], 0.0],
            );

            dirty = true;
        }
    };

    canvas.onwheel = function (event) {
        mat4.translate(
            paraview_style_camera.translation,
            paraview_style_camera.translation,
            [0.0, 0.0, -event.deltaY * 0.1],
        );

        dirty = true;
    };
}

function setup_webgl() {
    const canvas = document.querySelector('#gl_canvas');
    const gl = canvas.getContext('webgl2');

    if (!gl) {
        alert('No WebGL2!');
        return null;
    }

    return gl;
}

function load_file(filename) {
    var request = new XMLHttpRequest();
    request.open('GET', filename, false); // `false` makes the request synchronous
    request.send(null);

    if (request.status === 200) {
        return request.responseText;
    }

    console.error("couldn't load file: " + filename);
}

function setup_filepicker(gl, render_state) {
    var file_selection = document.querySelector('#sundial-obj');

    var mesh = new Mesh(load_file(test_dial));
    render_state.sundial.mesh = initMeshBuffers(gl, mesh);

    file_selection.oninput = function (event) {
        var reader = new FileReader();

        reader.onload = function (filecontents) {
            var mesh = new Mesh(filecontents.target.result);
            render_state.sundial.mesh = initMeshBuffers(gl, mesh);
        };

        reader.readAsText(event.target.files[0]);
    };
}

// OK how do the stencil shadows work again?
//
// I create a little triangular prism for every triangle in the mesh.
// (can do this with instanced rendering? or just the hard way)
//
// need the normals to be correct for this!
//
// clear the stencil buffer
// draw all the shadow prism fronts, increment-wrap-ing the stencil on Z-fail
// draw all the shadow prism backs, decrement-wrap-ing the stencil on Z-fail
//
// draw the fully lit scene wherever the stencil is 0

// how do I make the shadow volumes?
// make two copies of the vertex position information
// one extra piece of data, determining what end the vertices are at
// go through each triple of index data
//
// really we'll need per-face normals, will have to precalculate those
// can I do it differently? like the sun end and the not-sun end?

// alternative: can I just draw the shadow edges?
// put stuff on the GPU for each edge,
// with the face normals from each side
// (this is a lot less stuff)

// can I raytrace the shadows (in WebGL?) yes it would be lols do that next

// 8 triangles of shadow volume per triangle of sundial? can we do better?

function draw_to_canvas(gl, render_state, camera) {

    gl.clearColor(0.0, 0.0, 0.5, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.enable(gl.DEPTH_TEST);

    if (render_state.sundial.mesh == null) {
        return;
    }

    gl.useProgram(render_state.sundial.program);

    gl.uniformMatrix4fv(
        gl.getUniformLocation(render_state.sundial.program, 'world_to_clip'),
        false,
        camera.world_to_clip,
    );

    gl.bindBuffer(gl.ARRAY_BUFFER, render_state.sundial.mesh.vertexBuffer);

    const pos_attr = gl.getAttribLocation(
        render_state.sundial.program,
        'world_position',
    );
    gl.enableVertexAttribArray(pos_attr);
    gl.vertexAttribPointer(
        pos_attr,
        render_state.sundial.mesh.vertexBuffer.itemSize,
        gl.FLOAT,
        false,
        0,
        0,
    );

    gl.bindBuffer(
        gl.ELEMENT_ARRAY_BUFFER,
        render_state.sundial.mesh.indexBuffer,
    );

    gl.drawElements(
        gl.TRIANGLES,
        render_state.sundial.mesh.indexBuffer.numItems,
        gl.UNSIGNED_SHORT,
        0,
    );
}

function vector_to_sun(altitude, azimuth) {
    let x = -Math.sin(azimuth);
    let y = -Math.cos(azimuth);

    let horizontal_length = Math.cos(altitude);
    let z = Math.sin(altitude);

    return vec3.fromValues(horizontal_length * x, horizontal_length * y, z);
}

function main() {
    const gl = setup_webgl();
    setup_camera_controls();

    let today = new Date();
    let latitude = 52;
    let longitude = 0;

    let sun_pos = SunCalc.getPosition(today, latitude, longitude);

    let sun_position_element = document.querySelector('#sun-pos');
    sun_position_element.textContent = JSON.stringify(sun_pos);

    console.log(
        'vector to sun: ',
        vector_to_sun(sun_pos.altitude, sun_pos.azimuth),
    );

    let render_state = {
        sundial: {
            mesh: null,
            program: shaders.sundial_shader(gl),
        },
    };

    setup_filepicker(gl, render_state);

    function render(now) {
        let camera = mouse_based_orbit_camera();

        if (dirty) {
            draw_to_canvas(gl, render_state, camera);
            dirty = false;
        }

        requestAnimationFrame(render);
    }

    requestAnimationFrame(render);
}

// implementation plan
//
// [X] given altitude + azimuth determine direction to sun in the
//     X east Y north coordinate system
//
// [X] load an OBJ sundial
//
// [X] render the sundial
//
// [X] camera controls
//
// [ ] shadow volume extrusion
//
// [ ] stencil shadows
//
// [ ] render textures
//
// [ ] hook up the date time lat long controls

main();
