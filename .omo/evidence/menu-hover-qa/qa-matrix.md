# Header menu QA

| State | Expected | Observed |
| --- | --- | --- |
| Rest | No submenu is visible | Pass: no submenu visible in `rest.png` |
| Mouse click on `조직 운영` | Click must not pin the submenu | Pass: `activeElement=null`, `opacity=0`, `visibility=hidden`; `click-hidden.png` matches the rest state |
| Keyboard focus on `조직 운영` | One submenu is visible for keyboard users | Pass: `:focus-visible=true`, `opacity=1`, `visibility=visible`; `keyboard-focus.png` shows one readable submenu |

## Scope

- `frontend/src/components/Header.jsx`: mouse click blurs only when `event.detail > 0`; keyboard activation is not blurred.
- `frontend/src/styles/main.css`: submenu opens from `.header-nav-group:hover` or `.header-nav-group:has(:focus-visible)`.
- Korean submenu labels are single-line and unclipped in the keyboard-focus capture.
