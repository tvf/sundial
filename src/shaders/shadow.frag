#version 300 es

precision highp float;

in vec3 frag_world_position;

layout(location = 0) out vec4 color;

void main(void) {

    vec3 calculated_normal = normalize(cross(dFdx(vec3(frag_world_position)),
                                             dFdy(vec3(frag_world_position))));

    calculated_normal += 1.f;
    calculated_normal /= 2.f;
    color = vec4(calculated_normal, 1.f);
//    color = vec4(0.5f, 0.5f, 0.5f, 1.f);
}
