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

function mouse_based_orbit_camera(gl) {
    const fieldOfView = (45 * Math.PI) / 180; // in radians

    gl.canvas.width = gl.canvas.clientWidth;
    gl.canvas.height = gl.canvas.clientHeight;
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight

    //const aspect = 640 / 480;
    const zNear = 4;
    const zFar = 2000.0;
    const projectionMatrix = mat4.create();

    mat4.perspective(projectionMatrix, fieldOfView, aspect, zNear, zFar);

    // mat4.ortho(projectionMatrix, -16.0, 16.0, -12.0, 12.0, zNear, zFar);
    // TODO make the zoom controls nice with the orthographic view

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
    const canvas = document.querySelector('#gl_canvas') as HTMLCanvasElement;

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
    const canvas = document.querySelector('#gl_canvas') as HTMLCanvasElement;
    const gl = canvas.getContext('webgl2', { stencil: true });

    if (!gl) {
        alert('No WebGL2!');
        return null;
    }

    return gl;
}

function make_shadow_cap_mesh(gl: WebGLRenderingContext, model_mesh: Mesh) {
    let positions: number[] = [];
    let normals: number[] = [];
    let indices: number[] = [];

    for (let i = 0; i < model_mesh.indices.length; i += 3) {
        let base_index = positions.length / 3;

        let i1 = model_mesh.indices[i];
        let v1 = vec3.fromValues(
            model_mesh.vertices[i1 * 3 + 0],
            model_mesh.vertices[i1 * 3 + 1],
            model_mesh.vertices[i1 * 3 + 2],
        );

        let i2 = model_mesh.indices[i + 1];
        let v2 = vec3.fromValues(
            model_mesh.vertices[i2 * 3 + 0],
            model_mesh.vertices[i2 * 3 + 1],
            model_mesh.vertices[i2 * 3 + 2],
        );

        let i3 = model_mesh.indices[i + 2];
        let v3 = vec3.fromValues(
            model_mesh.vertices[i3 * 3 + 0],
            model_mesh.vertices[i3 * 3 + 1],
            model_mesh.vertices[i3 * 3 + 2],
        );

        // assume ccw triangle
        let normal = vec3.cross(
            vec3.create(),
            vec3.subtract(vec3.create(), v2, v1),
            vec3.subtract(vec3.create(), v3, v1),
        );

        vec3.normalize(normal, normal);

        Array.prototype.push.apply(positions, v1);
        Array.prototype.push.apply(positions, v2);
        Array.prototype.push.apply(positions, v3);

        Array.prototype.push.apply(normals, normal);
        Array.prototype.push.apply(normals, normal);
        Array.prototype.push.apply(normals, normal);

        indices.push(base_index + 0, base_index + 1, base_index + 2);
    }

    const position_buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, position_buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
    position_buffer['itemSize'] = 3;

    const normal_buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, normal_buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STATIC_DRAW);
    normal_buffer['itemSize'] = 3;

    const index_buffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, index_buffer);
    gl.bufferData(
        gl.ELEMENT_ARRAY_BUFFER,
        new Uint32Array(indices),
        gl.STATIC_DRAW,
    );
    index_buffer['numItems'] = indices.length;

    let result = {
        vertexBuffer: position_buffer,
        indexBuffer: index_buffer,
        normalBuffer: normal_buffer,
    };

    return result;
}

function make_shadow_mesh(gl: WebGLRenderingContext, model_mesh: Mesh) {
    // keys are "index index" pairs
    let triangle_normals_by_edge_indices = {};
    let edges = {};

    for (let i = 0; i < model_mesh.indices.length; i += 3) {
        let i1 = model_mesh.indices[i];
        let v1 = vec3.fromValues(
            model_mesh.vertices[i1 * 3 + 0],
            model_mesh.vertices[i1 * 3 + 1],
            model_mesh.vertices[i1 * 3 + 2],
        );

        let i2 = model_mesh.indices[i + 1];
        let v2 = vec3.fromValues(
            model_mesh.vertices[i2 * 3 + 0],
            model_mesh.vertices[i2 * 3 + 1],
            model_mesh.vertices[i2 * 3 + 2],
        );

        let i3 = model_mesh.indices[i + 2];
        let v3 = vec3.fromValues(
            model_mesh.vertices[i3 * 3 + 0],
            model_mesh.vertices[i3 * 3 + 1],
            model_mesh.vertices[i3 * 3 + 2],
        );

        // assume ccw triangle
        let normal = vec3.cross(
            vec3.create(),
            vec3.subtract(vec3.create(), v2, v1),
            vec3.subtract(vec3.create(), v3, v1),
        );

        vec3.normalize(normal, normal);

        let e1_key = i1 + ' ' + i2;
        let e2_key = i2 + ' ' + i3;
        let e3_key = i3 + ' ' + i1;

        triangle_normals_by_edge_indices[e1_key] = normal;
        triangle_normals_by_edge_indices[e2_key] = normal;
        triangle_normals_by_edge_indices[e3_key] = normal;

        if (i1 < i2) {
            edges[i1 + ' ' + i2] = [i1, i2, v1, v2];
        } else {
            edges[i2 + ' ' + i1] = [i2, i1, v2, v1];
        }

        if (i2 < i3) {
            edges[i2 + ' ' + i3] = [i2, i3, v2, v3];
        } else {
            edges[i3 + ' ' + i2] = [i3, i2, v3, v2];
        }

        if (i3 < i1) {
            edges[i3 + ' ' + i1] = [i3, i1, v3, v1];
        } else {
            edges[i1 + ' ' + i3] = [i1, i3, v1, v3];
        }
    }

    let positions: number[] = [];
    let primary_normal: number[] = [];
    let secondary_normal: number[] = [];
    let indices: number[] = [];

    for (const edge in edges) {
        let i1 = edges[edge][0];
        let i2 = edges[edge][1];
        let v1 = edges[edge][2];
        let v2 = edges[edge][3];

        let base_index = positions.length / 3;

        Array.prototype.push.apply(positions, v1);
        Array.prototype.push.apply(positions, v1);
        Array.prototype.push.apply(positions, v2);
        Array.prototype.push.apply(positions, v2);

        let primary_normal_12 = vec3.zero(vec3.create());
        if (triangle_normals_by_edge_indices.hasOwnProperty(i1 + ' ' + i2)) {
            primary_normal_12 = triangle_normals_by_edge_indices[i1 + ' ' + i2];
        }

        let secondary_normal_12 = vec3.zero(vec3.create());
        if (triangle_normals_by_edge_indices.hasOwnProperty(i2 + ' ' + i1)) {
            secondary_normal_12 =
                triangle_normals_by_edge_indices[i2 + ' ' + i1];
        }

        Array.prototype.push.apply(primary_normal, primary_normal_12);
        Array.prototype.push.apply(primary_normal, secondary_normal_12);
        Array.prototype.push.apply(primary_normal, primary_normal_12);
        Array.prototype.push.apply(primary_normal, secondary_normal_12);

        Array.prototype.push.apply(secondary_normal, secondary_normal_12);
        Array.prototype.push.apply(secondary_normal, primary_normal_12);
        Array.prototype.push.apply(secondary_normal, secondary_normal_12);
        Array.prototype.push.apply(secondary_normal, primary_normal_12);

        indices.push(
            base_index + 0,
            base_index + 1,
            base_index + 2,
            base_index + 1,
            base_index + 3,
            base_index + 2,
        );
    }

    // console.log(indices);
    // console.log(positions);
    // console.log(primary_normal);
    // console.log(secondary_normal);

    const position_buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, position_buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
    position_buffer['itemSize'] = 3;

    const primary_normal_buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, primary_normal_buffer);
    gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array(primary_normal),
        gl.STATIC_DRAW,
    );
    primary_normal_buffer['itemSize'] = 3;

    const secondary_normal_buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, secondary_normal_buffer);
    gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array(secondary_normal),
        gl.STATIC_DRAW,
    );
    secondary_normal_buffer['itemSize'] = 3;

    const index_buffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, index_buffer);
    gl.bufferData(
        gl.ELEMENT_ARRAY_BUFFER,
        new Uint32Array(indices),
        gl.STATIC_DRAW,
    );
    index_buffer['numItems'] = indices.length;

    let result = {
        vertexBuffer: position_buffer,
        indexBuffer: index_buffer,
        primaryNormalBuffer: primary_normal_buffer,
        secondaryNormalBuffer: secondary_normal_buffer,
    };

    return result;
}

function populate_meshes(gl, render_state, obj_string : string) {
    let mesh = new Mesh(obj_string);
    render_state.sundial.mesh = initMeshBuffers(gl, mesh);
    render_state.sundial.shadow_mesh = make_shadow_mesh(gl, mesh);
    render_state.sundial.shadow_cap_mesh = make_shadow_cap_mesh(gl, mesh);
}

interface HTMLInputEvent extends Event {
    target: HTMLInputElement & EventTarget;
}

function setup_filepicker(gl, render_state) {
    var file_selection = document.querySelector(
        '#sundial-obj',
    ) as HTMLInputElement;

    populate_meshes(gl, render_state, test_dial);

    file_selection.oninput = function (event: HTMLInputEvent) {
        var reader = new FileReader();

        reader.onload = function (filecontents : ProgressEvent<FileReader>) {
            populate_meshes(gl, render_state, filecontents.target.result as string);
        };

        reader.readAsText(event.target.files[0]);
    };
}

function draw_sundial(gl, render_state, camera, brightness) {
    let shader = render_state.sundial.program;

    gl.useProgram(shader);

    gl.uniformMatrix4fv(
        gl.getUniformLocation(shader, 'world_to_clip'),
        false,
        camera.world_to_clip,
    );

    gl.uniform3fv(
        gl.getUniformLocation(shader, 'to_sun'),
        render_state.sundial.to_sun,
    );

    gl.uniform1f(gl.getUniformLocation(shader, 'brightness'), brightness);

    gl.bindBuffer(gl.ARRAY_BUFFER, render_state.sundial.mesh.vertexBuffer);

    const pos_attr = gl.getAttribLocation(shader, 'world_position');
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

function draw_shadow_caps(gl, render_state, camera, translation) {
    let shader = render_state.sundial.shadow_cap_program;

    gl.useProgram(shader);

    gl.uniformMatrix4fv(
        gl.getUniformLocation(shader, 'world_to_clip'),
        false,
        camera.world_to_clip,
    );

    gl.uniform3fv(
        gl.getUniformLocation(shader, 'to_sun'),
        render_state.sundial.to_sun,
    );

    gl.uniform1f(gl.getUniformLocation(shader, 'shadow_length'), translation);

    {
        gl.bindBuffer(
            gl.ARRAY_BUFFER,
            render_state.sundial.shadow_cap_mesh.vertexBuffer,
        );

        const pos_attr = gl.getAttribLocation(shader, 'world_position');
        gl.enableVertexAttribArray(pos_attr);
        gl.vertexAttribPointer(
            pos_attr,
            render_state.sundial.shadow_cap_mesh.vertexBuffer.itemSize,
            gl.FLOAT,
            false,
            0,
            0,
        );
    }

    {
        gl.bindBuffer(
            gl.ARRAY_BUFFER,
            render_state.sundial.shadow_cap_mesh.normalBuffer,
        );

        const pos_attr = gl.getAttribLocation(shader, 'normal');
        gl.enableVertexAttribArray(pos_attr);
        gl.vertexAttribPointer(
            pos_attr,
            render_state.sundial.shadow_cap_mesh.normalBuffer.itemSize,
            gl.FLOAT,
            false,
            0,
            0,
        );
    }

    gl.bindBuffer(
        gl.ELEMENT_ARRAY_BUFFER,
        render_state.sundial.shadow_cap_mesh.indexBuffer,
    );

    gl.drawElements(
        gl.TRIANGLES,
        render_state.sundial.shadow_cap_mesh.indexBuffer.numItems,
        gl.UNSIGNED_INT,
        0,
    );
}

function draw_shadow_volume(gl, render_state, camera, translation) {
    let shader = render_state.sundial.shadow_program;

    gl.useProgram(shader);

    gl.uniformMatrix4fv(
        gl.getUniformLocation(shader, 'world_to_clip'),
        false,
        camera.world_to_clip,
    );

    gl.uniform3fv(
        gl.getUniformLocation(shader, 'to_sun'),
        render_state.sundial.to_sun,
    );

    gl.uniform1f(gl.getUniformLocation(shader, 'shadow_length'), translation);

    {
        gl.bindBuffer(
            gl.ARRAY_BUFFER,
            render_state.sundial.shadow_mesh.vertexBuffer,
        );

        const pos_attr = gl.getAttribLocation(shader, 'world_position');
        gl.enableVertexAttribArray(pos_attr);
        gl.vertexAttribPointer(
            pos_attr,
            render_state.sundial.shadow_mesh.vertexBuffer.itemSize,
            gl.FLOAT,
            false,
            0,
            0,
        );
    }

    {
        gl.bindBuffer(
            gl.ARRAY_BUFFER,
            render_state.sundial.shadow_mesh.primaryNormalBuffer,
        );

        const pos_attr = gl.getAttribLocation(shader, 'primary_normal');
        gl.enableVertexAttribArray(pos_attr);
        gl.vertexAttribPointer(
            pos_attr,
            render_state.sundial.shadow_mesh.primaryNormalBuffer.itemSize,
            gl.FLOAT,
            false,
            0,
            0,
        );
    }

    {
        gl.bindBuffer(
            gl.ARRAY_BUFFER,
            render_state.sundial.shadow_mesh.secondaryNormalBuffer,
        );

        const pos_attr = gl.getAttribLocation(shader, 'secondary_normal');
        gl.enableVertexAttribArray(pos_attr);
        gl.vertexAttribPointer(
            pos_attr,
            render_state.sundial.shadow_mesh.secondaryNormalBuffer.itemSize,
            gl.FLOAT,
            false,
            0,
            0,
        );
    }

    gl.bindBuffer(
        gl.ELEMENT_ARRAY_BUFFER,
        render_state.sundial.shadow_mesh.indexBuffer,
    );

    gl.drawElements(
        gl.TRIANGLES,
        render_state.sundial.shadow_mesh.indexBuffer.numItems,
        gl.UNSIGNED_INT,
        0,
    );
}

function draw_to_canvas(gl, render_state, camera) {
    if (render_state.sundial.to_sun[2] < 0) {
        gl.clearColor(0.0, 0.0, 0.2, 1.0);
    } else {
        gl.clearColor(1.0, 1.0, 1.0, 1.0);
    }

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);

    gl.enable(gl.STENCIL_TEST);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LESS);

    // gl.enable(gl.CULL_FACE);

    if (render_state.sundial.mesh != null) {
        if (render_state.sundial.to_sun[2] < 0) {
            draw_sundial(gl, render_state, camera, 0.1); // draw shady bit
        } else {
            gl.colorMask(false, false, false, false); // don't update colors

            // fill the depth buffer
            draw_sundial(gl, render_state, camera, 0);

            gl.depthMask(false); // no more writing to the depth buffer

            gl.stencilFunc(gl.ALWAYS, 0, 0);
            gl.stencilOpSeparate(gl.BACK, gl.KEEP, gl.INCR_WRAP, gl.KEEP);
            gl.stencilOpSeparate(gl.FRONT, gl.KEEP, gl.DECR_WRAP, gl.KEEP);

            draw_shadow_volume(
                gl,
                render_state,
                camera,
                render_state.sundial.shadow_length,
            );

            gl.frontFace(gl.CW);
            draw_shadow_caps(gl, render_state, camera, 0);
            gl.frontFace(gl.CCW);
            draw_shadow_caps(
                gl,
                render_state,
                camera,
                render_state.sundial.shadow_length,
            );

            gl.stencilOpSeparate(gl.BACK, gl.KEEP, gl.KEEP, gl.KEEP);
            gl.stencilOpSeparate(gl.FRONT, gl.KEEP, gl.KEEP, gl.KEEP);

            gl.colorMask(true, true, true, true); // update colors

            gl.depthFunc(gl.EQUAL);

            gl.stencilFunc(gl.NOTEQUAL, 0, 0xff);
            draw_sundial(gl, render_state, camera, 0.1); // draw shady bit

            gl.stencilFunc(gl.EQUAL, 0, 0xff);
            draw_sundial(gl, render_state, camera, 1); // draw sunny bit

            gl.depthMask(true); // unmask depth buffer
        }
    }
}

function vector_to_sun(altitude, azimuth) {
    let x = -Math.sin(azimuth);
    let y = -Math.cos(azimuth);

    let horizontal_length = Math.cos(altitude);
    let z = Math.sin(altitude);

    return vec3.fromValues(horizontal_length * x, horizontal_length * y, z);
}

function sun_position_for_time(now) {
    // now is in ms since the animation began

    let latitude = 52;
    let longitude = 0;

    let date = new Date();
    date.setHours(10);
    date.setMinutes(45);
    date.setSeconds(0);
    date.setMilliseconds(0);

    let sun_pos = SunCalc.getPosition(date, latitude, longitude);

    let time_element = document.querySelector('#time');
    let to_sun = vector_to_sun(sun_pos.altitude, sun_pos.azimuth);

    time_element.textContent = date.toDateString() + ' ' + date.toTimeString();

    return vec3.fromValues(0.18, 0.01, 0.7);
    // return to_sun;
}

function main() {
    const gl = setup_webgl();
    setup_camera_controls();

    let today = new Date();
    let latitude = 52;
    let longitude = 0;

    let sun_pos = SunCalc.getPosition(today, latitude, longitude);

    //     let sun_position_element = document.querySelector('#sun-pos');
    //     sun_position_element.textContent = JSON.stringify(sun_pos);

    let to_sun = vector_to_sun(sun_pos.altitude, sun_pos.azimuth);
    console.log('vector to sun: ', to_sun);

    let render_state = {
        sundial: {
            mesh: null,
            program: shaders.sundial_shader(gl),

            shadow_mesh: null,
            shadow_program: shaders.shadow_shader(gl),

            shadow_cap_mesh: null,
            shadow_cap_program: shaders.shadow_cap_shader(gl),

            to_sun: vec3.fromValues(Math.SQRT1_2, 0, Math.SQRT1_2),

            shadow_length: 200,
        },
    };

    setup_filepicker(gl, render_state);

    function render(now) {
        let camera = mouse_based_orbit_camera(gl);

        render_state.sundial.to_sun = sun_position_for_time(24 * 60 * 6 * now);

        // if (dirty) {
        draw_to_canvas(gl, render_state, camera);
        dirty = false;
        // }

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
// [X] shadow volume extrusion
//
// [X] stencil shadows
//
// [ ] render textures
//
// [ ] hook up the date time lat long controls

main();
