// Common vertex shader for full-screen quad rendering
export const BASE_VERTEX_SHADER = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`;

// Advection: Moves quantities (velocity/density) along the velocity field
export const ADVECTION_SHADER = `
  varying vec2 vUv;
  uniform sampler2D uVelocity;
  uniform sampler2D uSource;
  uniform vec2 texelSize;
  uniform float dt;
  uniform float dissipation;

  void main() {
    vec2 coord = vUv - dt * texture2D(uVelocity, vUv).xy * texelSize;
    gl_FragColor = texture2D(uSource, coord) * dissipation;
  }
`;

// Splat: Adds force/color at a specific point (mouse interaction)
export const SPLAT_SHADER = `
  varying vec2 vUv;
  uniform sampler2D uTarget;
  uniform float aspectRatio;
  uniform vec3 color;
  uniform vec2 point;
  uniform float radius;

  void main() {
    vec2 p = vUv - point.xy;
    p.x *= aspectRatio;
    vec3 splat = exp(-dot(p, p) / radius) * color;
    vec3 base = texture2D(uTarget, vUv).xyz;
    gl_FragColor = vec4(base + splat, 1.0);
  }
`;

// Divergence: Calculates how much "stuff" is flowing in/out of a cell
export const DIVERGENCE_SHADER = `
  varying vec2 vUv;
  uniform sampler2D uVelocity;
  uniform vec2 texelSize;

  void main() {
    float L = texture2D(uVelocity, vUv - vec2(texelSize.x, 0.0)).x;
    float R = texture2D(uVelocity, vUv + vec2(texelSize.x, 0.0)).x;
    float T = texture2D(uVelocity, vUv + vec2(0.0, texelSize.y)).y;
    float B = texture2D(uVelocity, vUv - vec2(0.0, texelSize.y)).y;

    vec2 C = texture2D(uVelocity, vUv).xy;
    if (vUv.x < 0.0) { L = -C.x; }
    if (vUv.x > 1.0) { R = -C.x; }
    if (vUv.y > 1.0) { T = -C.y; }
    if (vUv.y < 0.0) { B = -C.y; }

    float div = 0.5 * (R - L + T - B);
    gl_FragColor = vec4(div, 0.0, 0.0, 1.0);
  }
`;

// Pressure: Solves the pressure field (Jacobi iteration)
export const PRESSURE_SHADER = `
  varying vec2 vUv;
  uniform sampler2D uPressure;
  uniform sampler2D uDivergence;
  uniform vec2 texelSize;

  void main() {
    float L = texture2D(uPressure, vUv - vec2(texelSize.x, 0.0)).x;
    float R = texture2D(uPressure, vUv + vec2(texelSize.x, 0.0)).x;
    float T = texture2D(uPressure, vUv + vec2(0.0, texelSize.y)).x;
    float B = texture2D(uPressure, vUv - vec2(0.0, texelSize.y)).x;
    float C = texture2D(uPressure, vUv).x;
    float divergence = texture2D(uDivergence, vUv).x;
    float pressure = (L + R + B + T - divergence) * 0.25;
    gl_FragColor = vec4(pressure, 0.0, 0.0, 1.0);
  }
`;

// Gradient Subtract: Removes divergence from velocity field using pressure gradient
export const GRADIENT_SUBTRACT_SHADER = `
  varying vec2 vUv;
  uniform sampler2D uPressure;
  uniform sampler2D uVelocity;
  uniform vec2 texelSize;

  void main() {
    float L = texture2D(uPressure, vUv - vec2(texelSize.x, 0.0)).x;
    float R = texture2D(uPressure, vUv + vec2(texelSize.x, 0.0)).x;
    float T = texture2D(uPressure, vUv + vec2(0.0, texelSize.y)).x;
    float B = texture2D(uPressure, vUv - vec2(0.0, texelSize.y)).x;
    vec2 velocity = texture2D(uVelocity, vUv).xy;
    velocity.xy -= vec2(R - L, T - B);
    gl_FragColor = vec4(velocity, 0.0, 1.0);
  }
`;

// Display: Final output rendering with aesthetic color mapping, vignette and tone mapping
export const DISPLAY_SHADER = `
  varying vec2 vUv;
  uniform sampler2D uTexture;
  uniform sampler2D uVelocity;
  
  void main() {
    vec3 c = texture2D(uTexture, vUv).rgb;
    
    // Vignette
    vec2 uv = vUv * (1.0 - vUv.yx); // 0..1
    float vig = uv.x * uv.y * 20.0; 
    vig = pow(vig, 0.2);
    
    // Tone mapping (ACES Approximation-ish / Reinhard)
    vec3 mapped = c / (c + vec3(1.0));
    
    // Gamma correction
    mapped = pow(mapped, vec3(1.0 / 2.2));
    
    // Apply vignette
    gl_FragColor = vec4(mapped * vig, 1.0);
  }
`;