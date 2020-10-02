import SunCalc from 'suncalc';

function main() {

    let today = new Date();
    let latitude = 52;
    let longitude = 0;

    let sun_pos = SunCalc.getPosition(today, latitude, longitude);

    let sun_position_element = document.querySelector('#sun-pos');
    sun_position_element.textContent = JSON.stringify(sun_pos);
}

// implementation plan
//
// [ ] given altitude + azimuth determine direction to sun in the
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
//

main();
