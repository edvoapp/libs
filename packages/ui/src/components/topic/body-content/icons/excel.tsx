import { FunctionComponent, JSX } from 'preact';

export const Excel: FunctionComponent<JSX.SVGAttributes> = ({ children, ...props }) => {
  return (
    <svg width="100" height="100" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path
        d="M85.999 12C85.999 6.47716 81.5219 2 75.999 2L36.0899 2L36.0899 15.6C36.0899 20.0183 32.5082 23.6 28.0899 23.6L13.999 23.6L13.999 87.9999C13.999 93.5227 18.4762 97.9999 23.999 97.9999L75.999 97.9999C81.5219 97.9999 85.999 93.5227 85.999 87.9999L85.999 12Z"
        fill="#ACFF85"
      />
      <g filter="url(#filter0_d_2310_242082)">
        <path
          d="M27.2715 22.8009L13.9988 22.8009L35.2715 2.00098L35.2715 14.8009C35.2715 19.2192 31.6898 22.8009 27.2715 22.8009Z"
          fill="#2E8F00"
        />
      </g>
      <rect
        width="16"
        height="6"
        rx="2"
        transform="matrix(1 -4.15781e-09 -4.15781e-09 -1 24 53.6055)"
        stroke="#2E8F00"
        fill="#2e8f00"
        stroke-width="1"
      />
      <rect
        width="16"
        height="6"
        rx="2"
        transform="matrix(1 -4.15781e-09 -4.15781e-09 -1 24.001 45.6055)"
        stroke="#2E8F00"
        fill="#2e8f00"
        stroke-width="1"
      />
      <rect
        width="16"
        height="6"
        rx="2"
        transform="matrix(1 -4.15781e-09 -4.15781e-09 -1 42.001 53.6055)"
        stroke="#2E8F00"
        fill="#2e8f00"
        stroke-width="1"
      />
      <rect
        width="16"
        height="6"
        rx="2"
        transform="matrix(1 -4.15781e-09 -4.15781e-09 -1 60 53.6045)"
        stroke="#2E8F00"
        fill="#2e8f00"
        stroke-width="1"
      />
      <rect
        width="16"
        height="6"
        rx="2"
        transform="matrix(1 -4.15781e-09 -4.15781e-09 -1 42 45.6055)"
        stroke="#2E8F00"
        fill="#2e8f00"
        stroke-width="1"
      />
      <rect
        width="16"
        height="6"
        rx="2"
        transform="matrix(1 -4.15781e-09 -4.15781e-09 -1 60 45.6055)"
        stroke="#2E8F00"
        fill="#2e8f00"
        stroke-width="1"
      />
      <rect
        width="16"
        height="6"
        rx="2"
        transform="matrix(1 -4.15781e-09 -4.15781e-09 -1 24 37.6055)"
        stroke="#2E8F00"
        fill="#2e8f00"
        stroke-width="1"
      />
      <rect
        width="16"
        height="6"
        rx="2"
        transform="matrix(1 -4.15781e-09 -4.15781e-09 -1 42.001 37.6055)"
        stroke="#2E8F00"
        fill="#2e8f00"
        stroke-width="1"
      />
      <rect
        width="16"
        height="6"
        rx="2"
        transform="matrix(1 -4.15781e-09 -4.15781e-09 -1 60.001 37.6055)"
        stroke="#2E8F00"
        fill="#2e8f00"
        stroke-width="1"
      />
      <g filter="url(#filter1_d_2310_242082)">
        <rect x="6" y="60" width="88" height="22" rx="11" fill="#2E8F00" />
      </g>
      <text
        text-anchor="middle"
        fill="white"
        font-size="16"
        font-weight="700"
        font-family="IBM Plex Mono"
        x="50"
        y="77"
      >
        {children}
      </text>
      <defs>
        <filter
          id="filter0_d_2310_242082"
          x="11.999"
          y="1.00098"
          width="27.2725"
          height="26.7998"
          filterUnits="userSpaceOnUse"
          color-interpolation-filters="sRGB"
        >
          <feFlood flood-opacity="0" result="BackgroundImageFix" />
          <feColorMatrix
            in="SourceAlpha"
            type="matrix"
            values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
            result="hardAlpha"
          />
          <feOffset dx="1" dy="2" />
          <feGaussianBlur stdDeviation="1.5" />
          <feComposite in2="hardAlpha" operator="out" />
          <feColorMatrix type="matrix" values="0 0 0 0 0.0392157 0 0 0 0 0.0313726 0 0 0 0 0.0431373 0 0 0 0.4 0" />
          <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_2310_242082" />
          <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow_2310_242082" result="shape" />
        </filter>
        <filter
          id="filter1_d_2310_242082"
          x="4"
          y="59"
          width="94"
          height="28"
          filterUnits="userSpaceOnUse"
          color-interpolation-filters="sRGB"
        >
          <feFlood flood-opacity="0" result="BackgroundImageFix" />
          <feColorMatrix
            in="SourceAlpha"
            type="matrix"
            values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
            result="hardAlpha"
          />
          <feOffset dx="1" dy="2" />
          <feGaussianBlur stdDeviation="1.5" />
          <feComposite in2="hardAlpha" operator="out" />
          <feColorMatrix type="matrix" values="0 0 0 0 0.0392157 0 0 0 0 0.0313726 0 0 0 0 0.0431373 0 0 0 0.4 0" />
          <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_2310_242082" />
          <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow_2310_242082" result="shape" />
        </filter>
      </defs>
    </svg>
  );
};
