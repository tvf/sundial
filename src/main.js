import SunCalc from 'suncalc';

import { vec3, mat4 } from 'gl-matrix';

var paraview_style_camera = {
  rotation: mat4.create(),
  translation: mat4.fromTranslation(mat4.create(), vec3.fromValues(0, 0, -20)),
};

var last_mouse_position = [0, 0];
var mouse_is_down = false;
var middle_mouse_is_down = false;
var shift_is_down = false;
var dirty = true;

function setup_camera_controls() {

  var handle_keydown = function(event) {
    if (event.keyCode === 16 || event.charCode === 16) {
      shift_is_down = true;
    }
  };

  var handle_keyup = function(event) {
    if (event.keyCode === 16 || event.charCode === 16) {
      shift_is_down = false;
    }
  };

  document.addEventListener('keydown', handle_keydown);
  document.addEventListener('keyup', handle_keyup);

  canvas.onmousedown = function(event) {
    if (event.button == 0) {
      mouse_is_down = true;
    }

    if (event.button == 1) {
      middle_mouse_is_down = true;
    }

    last_mousedown_location = [event.clientX, event.clientY];
  };

  canvas.onmouseup = function(event) {
    if (event.button == 0) {
      mouse_is_down = false;
    }

    if (event.button == 1) {
      middle_mouse_is_down = false;
    }

    if (
      last_mousedown_location &&
      event.clientX == last_mousedown_location[0] &&
      event.clientY == last_mousedown_location[1]
    ) {
      reference_position = mouseover_position;
      reference_normal = mouseover_normal;
    }
  };

  canvas.onmousemove = function(event) {
    const rect = canvas.getBoundingClientRect();

    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const last_mouse_delta = [x - last_mouse_position[0], y - last_mouse_position[1]];

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

    mouse_dirty = true;
  };

  canvas.onwheel = function(event) {
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

function vector_to_sun(altitude, azimuth) {
    let x = -Math.sin(azimuth);
    let y = -Math.cos(azimuth);

    let horizontal_length = Math.cos(altitude);
    let z = Math.sin(altitude);

    return vec3.fromValues(horizontal_length * x, horizontal_length * y, z);
}

function main() {
    const gl = setup_webgl();

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
}

// implementation plan
//
// [X] given altitude + azimuth determine direction to sun in the
//     X east Y north coordinate system
//
// [ ] load an OBJ sundial
//
// [ ] render the sundial
//
// [ ] render the texture
//
// [ ] camera controls
//
// [ ] shadow volume extrusion
//
// [ ] stencil shadows
//
// [ ] hook up the date time lat long controls

main();
