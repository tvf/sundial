import SunCalc from 'suncalc';

import { vec3, mat4 } from 'gl-matrix';

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

    console.log("vector to sun: ",
                vector_to_sun(sun_pos.altitude, sun_pos.azimuth));
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
// [ ] camera controls
//
// [ ] shadow volume extrusion
//
// [ ] stencil shadows
//
// [ ] hook up the date time lat long controls

main();
