#version 300 es

precision highp float;

in vec2 depth_zw;

layout(location = 0) out vec4 color;

void main(void) {
    color = vec4(1.f);

    if (depth_zw.y != 0.f) {
        float z = clamp(depth_zw.x / depth_zw.y, -1.f, 1.f);
        gl_FragDepth = (z + 1.f) * 0.5f;
    } else {
        gl_FragDepth = depth_zw.x > 0.f ? 1.f : 0.f;
    }
}
