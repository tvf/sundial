#version 300 es

precision highp float;

layout(location = 0) out vec4 color;

in float depth_z;
in float depth_w;

void main(void) {
    color = vec4(1.f);
    gl_FragDepth = clamp((depth_z / depth_w + 1.) * 0.5, 0.f, 1.f);
}