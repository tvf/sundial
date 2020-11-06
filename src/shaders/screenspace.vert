#version 300 es

precision highp float;

in vec3 world_position;

void main(void) {
    gl_Position = vec4(world_position.xy, 0.f, 1.f);
}