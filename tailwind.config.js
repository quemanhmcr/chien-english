/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./**/*.{js,ts,jsx,tsx}",
        "!./node_modules/**/*",
        "!./dist/**/*"
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ['Inter', 'sans-serif'],
                heading: ['Nunito', 'sans-serif'],
            },
            animation: {
                'slide-up': 'slideUp 0.2s cubic-bezier(0.05, 0.7, 0.1, 1)',
                'fade-in': 'fadeIn 0.15s cubic-bezier(0, 0, 0, 1)',
                'scale-in': 'scaleIn 0.15s cubic-bezier(0.05, 0.7, 0.1, 1)',
            },
            keyframes: {
                slideUp: {
                    '0%': { transform: 'translateY(8px)', opacity: '0' },
                    '100%': { transform: 'translateY(0)', opacity: '1' },
                },
                fadeIn: {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' },
                },
                scaleIn: {
                    '0%': { transform: 'scale(0.95)', opacity: '0' },
                    '100%': { transform: 'scale(1)', opacity: '1' },
                }
            },
            transitionTimingFunction: {
                'material': 'cubic-bezier(0.2, 0, 0, 1)',
                'material-decel': 'cubic-bezier(0.05, 0.7, 0.1, 1)',
                'material-accel': 'cubic-bezier(0.3, 0, 0.8, 0.15)',
            },
            transitionDuration: {
                'fast': '100ms',
                'normal': '150ms',
                'slow': '200ms',
            }
        }
    },
    plugins: [],
}

