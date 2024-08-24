import { h, FunctionComponent, JSX } from 'preact';

export const LogoCircle: FunctionComponent<JSX.SVGAttributes> = (props) => (
  <svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
    <rect x="0" width="32" height="32" rx="16" fill="#5D34D7" />
    <g filter="url(#filter0_dddddd_2982_4870)">
      <mask id="path-2-inside-1_2982_4870" fill="white">
        <path
          fill-rule="evenodd"
          clip-rule="evenodd"
          d="M16.3793 8.98831V15.3278C16.3793 15.6906 16.6722 15.9847 17.0334 15.9847H23.3456C23.7309 15.9847 24.0328 15.6521 23.9972 15.2668C23.6586 11.5961 20.7491 8.67402 17.0941 8.33391C16.7105 8.29823 16.3793 8.60146 16.3793 8.98831ZM15.6509 22.9812C15.6509 23.3681 15.3196 23.6713 14.936 23.6356C11.0458 23.2736 8 19.9864 8 15.9848C8 11.9831 11.0458 8.69592 14.936 8.33392C15.3196 8.29824 15.6509 8.60147 15.6509 8.98832V22.9812ZM16.3793 21.1477C16.3793 19.7552 17.5033 18.6264 18.8897 18.6264C20.2762 18.6264 21.4002 19.7552 21.4002 21.1477C21.4002 22.5402 20.2762 23.669 18.8897 23.669C17.5033 23.669 16.3793 22.5402 16.3793 21.1477Z"
        />
      </mask>
      <path
        fill-rule="evenodd"
        clip-rule="evenodd"
        d="M16.3793 8.98831V15.3278C16.3793 15.6906 16.6722 15.9847 17.0334 15.9847H23.3456C23.7309 15.9847 24.0328 15.6521 23.9972 15.2668C23.6586 11.5961 20.7491 8.67402 17.0941 8.33391C16.7105 8.29823 16.3793 8.60146 16.3793 8.98831ZM15.6509 22.9812C15.6509 23.3681 15.3196 23.6713 14.936 23.6356C11.0458 23.2736 8 19.9864 8 15.9848C8 11.9831 11.0458 8.69592 14.936 8.33392C15.3196 8.29824 15.6509 8.60147 15.6509 8.98832V22.9812ZM16.3793 21.1477C16.3793 19.7552 17.5033 18.6264 18.8897 18.6264C20.2762 18.6264 21.4002 19.7552 21.4002 21.1477C21.4002 22.5402 20.2762 23.669 18.8897 23.669C17.5033 23.669 16.3793 22.5402 16.3793 21.1477Z"
        fill="url(#paint0_linear_2982_4870)"
      />
    </g>
    <defs>
      <filter
        id="filter0_dddddd_2982_4870"
        x="0"
        y="0"
        width="48"
        height="48"
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
        <feOffset dy="4" />
        <feGaussianBlur stdDeviation="2" />
        <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.07 0" />
        <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_2982_4870" />
        <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow_2982_4870" result="shape" />
      </filter>
      <linearGradient
        id="paint0_linear_2982_4870"
        x1="28"
        y1="8.33105"
        x2="28"
        y2="23.669"
        gradientUnits="userSpaceOnUse"
      >
        <stop stop-color="white" />
        <stop offset="1" stop-color="white" stop-opacity="0" />
      </linearGradient>
    </defs>
  </svg>
);

export default LogoCircle;
