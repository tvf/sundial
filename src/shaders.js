import sundial_vert from './shaders/sundial.vert';
import sundial_frag from './shaders/sundial.frag';

import shadow_vert from './shaders/shadow.vert';
import shadow_frag from './shaders/shadow.frag';

import shadow_cap_vert from './shaders/shadow_cap.vert';
import shadow_cap_frag from './shaders/shadow_cap.frag';

import screenspace_vert from './shaders/screenspace.vert';
import screenspace_frag from './shaders/screenspace.frag';

function init_shader_program(gl, v_source, f_source) {
    const v_shader = load_shader(gl, gl.VERTEX_SHADER, v_source);
    const f_shader = load_shader(gl, gl.FRAGMENT_SHADER, f_source);

    const shader_program = gl.createProgram();
    gl.attachShader(shader_program, v_shader);
    gl.attachShader(shader_program, f_shader);
    gl.linkProgram(shader_program);

    if (!gl.getProgramParameter(shader_program, gl.LINK_STATUS)) {
        alert('link error: ' + gl.getProgramInfoLog(shader_program));
        return null;
    }

    return shader_program;
}

function load_shader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        alert('compile error: ' + gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }

    return shader;
}

export function sundial_shader(gl) {
    return init_shader_program(gl, sundial_vert, sundial_frag);
}

export function shadow_shader(gl) {
    return init_shader_program(gl, shadow_vert, shadow_frag);
}

export function shadow_cap_shader(gl) {
    return init_shader_program(gl, shadow_cap_vert, shadow_cap_frag);
}

export function ground_plane_shader(gl) {
    return init_shader_program(gl, screenspace_vert, screenspace_frag);
}
