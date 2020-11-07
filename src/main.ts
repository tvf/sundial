import SunCalc from 'suncalc';

import { vec2, vec3, mat4, glMatrix } from 'gl-matrix';

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

var playing = false;
var time_for_sun = new Date();

var last_mouse_position = [0, 0];
var mouse_is_down = false;
var middle_mouse_is_down = false;
var shift_is_down = false;
var dirty = true;

function model_rotation_transform(): mat4 {
    let rot_x = Number(
        (document.querySelector('#rotX') as HTMLInputElement).value,
    );
    let rot_y = Number(
        (document.querySelector('#rotY') as HTMLInputElement).value,
    );
    let rot_z = Number(
        (document.querySelector('#rotZ') as HTMLInputElement).value,
    );

    let rotation = mat4.create();
    mat4.rotateX(rotation, rotation, glMatrix.toRadian(rot_x));
    mat4.rotateY(rotation, rotation, glMatrix.toRadian(rot_y));
    mat4.rotateZ(rotation, rotation, glMatrix.toRadian(rot_z));

    return rotation;
}

function mouse_based_orbit_camera(gl) {
    const fieldOfView = (45 * Math.PI) / 180; // in radians

    gl.canvas.width = gl.canvas.clientWidth;
    gl.canvas.height = gl.canvas.clientHeight;
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;

    //const aspect = 640 / 480;
    const zNear = 4;
    const zFar = 2000.0;
    const projectionMatrix = mat4.create();

    mat4.perspective(projectionMatrix, fieldOfView, aspect, zNear, zFar);

    // mat4.ortho(projectionMatrix, -10 * aspect, 10 * aspect, -10.0, 10.0, zNear, zFar);
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
    const gl = canvas.getContext('webgl2', { antialias: false, stencil: true });

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

function populate_meshes(gl, render_state, obj_string: string) {
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

        reader.onload = function (filecontents: ProgressEvent<FileReader>) {
            populate_meshes(
                gl,
                render_state,
                filecontents.target.result as string,
            );
        };

        reader.readAsText(event.target.files[0]);
    };
}

function draw_ground_plane(gl, render_state, camera, brightness) {
    let shader = render_state.sundial.ground_plane_program;

    gl.useProgram(shader);

    gl.uniformMatrix4fv(
        gl.getUniformLocation(shader, 'world_to_clip'),
        false,
        camera.world_to_clip,
    );

    gl.uniformMatrix4fv(
        gl.getUniformLocation(shader, 'clip_to_world'),
        false,
        camera.clip_to_world,
    );

    gl.uniform1f(gl.getUniformLocation(shader, 'brightness'), brightness);
    gl.uniform1f(
        gl.getUniformLocation(shader, 'ground_plane_height'),
        document.querySelector('#ground_plane_height').value,
    );

    let viewport = vec2.fromValues(gl.canvas.width, gl.canvas.height);
    gl.uniform2fv(gl.getUniformLocation(shader, 'viewport'), viewport);

    // Tell WebGL how to pull out the positions from the position
    // buffer into the vertexPosition attribute
    {
        gl.bindBuffer(
            gl.ARRAY_BUFFER,
            render_state.sundial.screenspace_triangles.position,
        );
        const pos_attr = gl.getAttribLocation(shader, 'world_position');
        gl.enableVertexAttribArray(pos_attr);

        gl.vertexAttribPointer(pos_attr, 3, gl.FLOAT, false, 0, 0);
    }

    gl.bindBuffer(
        gl.ELEMENT_ARRAY_BUFFER,
        render_state.sundial.screenspace_triangles.indices,
    );

    {
        const vertexCount = render_state.sundial.screenspace_triangles.count;
        const type = gl.UNSIGNED_SHORT;
        const offset = 0;
        gl.drawElements(gl.TRIANGLES, vertexCount, type, offset);
    }
}

function two_triangles(gl) {
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

    const positions = [
        -1.0,
        -1.0,
        1.0,
        1.0,
        -1.0,
        1.0,
        1.0,
        1.0,
        1.0,
        -1.0,
        1.0,
        1.0,
    ];

    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

    const indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);

    const indices = [0, 1, 2, 0, 2, 3];

    gl.bufferData(
        gl.ELEMENT_ARRAY_BUFFER,
        new Uint16Array(indices),
        gl.STATIC_DRAW,
    );

    return { position: positionBuffer, indices: indexBuffer, count: 6 };
}

function draw_sundial(gl, render_state, camera, brightness) {
    let shader = render_state.sundial.program;

    gl.useProgram(shader);

    gl.uniformMatrix4fv(
        gl.getUniformLocation(shader, 'model_to_world'),
        false,
        model_rotation_transform(),
    );

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
        gl.getUniformLocation(shader, 'model_to_world'),
        false,
        model_rotation_transform(),
    );

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
        gl.getUniformLocation(shader, 'model_to_world'),
        false,
        model_rotation_transform(),
    );

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
    let nighttime_label = document.querySelector(
        '#nighttime',
    ) as HTMLLabelElement;
    if (render_state.sundial.to_sun[2] < 0) {
        nighttime_label.style.visibility = 'visible';
        gl.clearColor(0.2, 0.2, 0.2, 1.0);
        document.body.style.color = 'lightgrey';
    } else {
        nighttime_label.style.visibility = 'hidden';
        gl.clearColor(1.0, 1.0, 1.0, 1.0);
        document.body.style.color = 'black';
    }

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);

    gl.enable(gl.STENCIL_TEST);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LESS);

    // gl.enable(gl.CULL_FACE);

    if (render_state.sundial.mesh != null) {
        if (render_state.sundial.to_sun[2] < 0) {
            draw_sundial(gl, render_state, camera, 0.1); // draw shady bit
            draw_ground_plane(gl, render_state, camera, 0.2); // draw shady bit
        } else {
            gl.colorMask(false, false, false, false); // don't update colors

            // fill the depth buffer
            draw_sundial(gl, render_state, camera, 0);
            draw_ground_plane(gl, render_state, camera, 0.2); // draw shady bit

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
            // gl.frontFace(gl.CW);
            // draw_shadow_caps(
            //     gl,
            //     render_state,
            //     camera,
            //     render_state.sundial.shadow_length,
            // );
            gl.frontFace(gl.CCW);

            gl.stencilOpSeparate(gl.BACK, gl.KEEP, gl.KEEP, gl.KEEP);
            gl.stencilOpSeparate(gl.FRONT, gl.KEEP, gl.KEEP, gl.KEEP);

            gl.colorMask(true, true, true, true); // update colors

            gl.depthFunc(gl.EQUAL);

            gl.stencilFunc(gl.NOTEQUAL, 0, 0xff);
            draw_sundial(gl, render_state, camera, 0.1); // draw shady bit
            draw_ground_plane(gl, render_state, camera, 0.2); // draw shady bit

            gl.stencilFunc(gl.EQUAL, 0, 0xff);
            draw_sundial(gl, render_state, camera, 1); // draw sunny bit
            draw_ground_plane(gl, render_state, camera, 1); // draw shady bit

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

function sun_position() {
    let lat_long = get_lat_long_ui();
    return sun_position_for_time(time_for_sun, lat_long[0], lat_long[1]);
}

function sun_position_for_time(time, latitude, longitude) {
    let sun_pos = SunCalc.getPosition(time, latitude, longitude);
    let to_sun = vector_to_sun(sun_pos.altitude, sun_pos.azimuth);

    return to_sun;
}

function update_simulation_time(delta: number) {
    if (playing) {
        let ms_adjustment = delta * get_speedup_ui();
        time_for_sun.setTime(time_for_sun.getTime() + ms_adjustment);
        set_date_ui(time_for_sun);
    }

    time_for_sun = get_date_ui();
}

function set_date_ui(date: Date) {
    (document.querySelector(
        '#year',
    ) as HTMLInputElement).value = date.getUTCFullYear().toString();
    (document.querySelector('#month') as HTMLInputElement).value = (
        date.getUTCMonth() + 1
    ).toString();
    (document.querySelector(
        '#day',
    ) as HTMLInputElement).value = date.getUTCDate().toString();
    (document.querySelector(
        '#hour',
    ) as HTMLInputElement).value = date.getUTCHours().toString();
    (document.querySelector(
        '#minute',
    ) as HTMLInputElement).value = date.getUTCMinutes().toString();
    (document.querySelector(
        '#second',
    ) as HTMLInputElement).value = date.getUTCSeconds().toString();
}

function get_date_ui(): Date {
    let date = new Date(0);
    date.setUTCFullYear(
        Number((document.querySelector('#year') as HTMLInputElement).value),
    );
    date.setUTCMonth(
        Number((document.querySelector('#month') as HTMLInputElement).value) -
            1,
    );
    date.setUTCDate(
        Number((document.querySelector('#day') as HTMLInputElement).value),
    );
    date.setUTCHours(
        Number((document.querySelector('#hour') as HTMLInputElement).value),
    );
    date.setUTCMinutes(
        Number((document.querySelector('#minute') as HTMLInputElement).value),
    );
    date.setUTCSeconds(
        Number((document.querySelector('#second') as HTMLInputElement).value),
    );
    return date;
}

function set_lat_long_ui(lat: Number, long: Number) {
    (document.querySelector(
        '#latitude',
    ) as HTMLInputElement).value = lat.toString();
    (document.querySelector(
        '#longitude',
    ) as HTMLInputElement).value = long.toString();
}

function get_lat_long_ui() {
    let lat = Number(
        (document.querySelector('#latitude') as HTMLInputElement).value,
    );
    let long = Number(
        (document.querySelector('#longitude') as HTMLInputElement).value,
    );

    return [lat, long];
}

function get_speedup_ui(): number {
    let speedup = document.querySelector('#speedup') as HTMLInputElement;
    return Number(speedup.value);
}

function setup_time_and_location_controls() {
    let speedup = document.querySelector('#speedup') as HTMLInputElement;
    speedup.value = Number(3600).toString();

    set_date_ui(time_for_sun);
    get_date_ui();

    // Stepney Green 51.5220° N, 0.0467° W
    set_lat_long_ui(51.522, -0.0467);

    let button = document.querySelector('#play') as HTMLButtonElement;
    button.textContent = 'Play';
    button.style.color = 'green';
    button.onclick = function () {
        playing = !playing;
        if (playing) {
            button.textContent = 'Stop';
            button.style.color = 'red';
        } else {
            button.textContent = 'Play';
            button.style.color = 'green';
        }
    };
}

function main() {
    const gl = setup_webgl();
    setup_camera_controls();

    let render_state = {
        sundial: {
            mesh: null,
            program: shaders.sundial_shader(gl),

            shadow_mesh: null,
            shadow_program: shaders.shadow_shader(gl),

            shadow_cap_mesh: null,
            shadow_cap_program: shaders.shadow_cap_shader(gl),

            screenspace_triangles: two_triangles(gl),
            ground_plane_program: shaders.ground_plane_shader(gl),

            to_sun: vec3.fromValues(Math.SQRT1_2, 0, Math.SQRT1_2),

            shadow_length: 200,
        },
    };

    setup_time_and_location_controls();

    setup_filepicker(gl, render_state);

    let then = 0;
    function render(now) {
        let camera = mouse_based_orbit_camera(gl);

        let delta = now - then;
        then = now;
        update_simulation_time(delta);
        render_state.sundial.to_sun = sun_position();

        // if (dirty) {
        draw_to_canvas(gl, render_state, camera);
        dirty = false;
        // }

        requestAnimationFrame(render);
    }

    requestAnimationFrame(render);
}

main();
