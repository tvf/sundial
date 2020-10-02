import sundial_vert from './shaders/sundial.vert';
import sundial_frag from './shaders/sundial.frag';

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
