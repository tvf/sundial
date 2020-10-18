#version 300 es

precision highp float;

in vec3 frag_world_position;

uniform vec3 to_sun;
uniform float brightness;

layout(location = 0) out vec4 color;

void main(void) {

    vec3 calculated_normal = normalize(cross(dFdx(vec3(frag_world_position)),
                                             dFdy(vec3(frag_world_position))));

    float illumination = dot(calculated_normal, to_sun);
    illumination += 1.f;
    illumination /= 2.f;
    color = vec4(vec3(illumination * brightness), 1.f);

    calculated_normal += 1.f;
    calculated_normal /= 2.f;
    color = vec4(calculated_normal * brightness, 1.f);

    // color = vec4(vec3(brightness * 0.9), 1.f);
}
