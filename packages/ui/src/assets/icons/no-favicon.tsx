import { FunctionComponent, JSX } from 'preact';

export const NoFavicon: FunctionComponent<JSX.SVGAttributes> = (props) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <rect width="24" height="24" rx="4" fill="#D4CFD5" />
    <g filter="url(#filter0_d_5871_423421)">
      <circle cx="12" cy="12" r="6.5" stroke="#EAE7EA" />
      <path
        d="M9.37478 13.5553L5.38867 11.222L6.16645 8.93728L8.11089 6.55534L11.5623 5.38867L14.6248 5.87478V5.96506C14.6248 7.06963 13.7294 7.96506 12.6248 7.96506H11.9998V9.49284C11.9998 10.0451 11.5521 10.4928 10.9998 10.4928H10.2498V11.8053H12.6248C13.7294 11.8053 14.6248 12.7008 14.6248 13.8053V14.6248H15.7428C16.5214 14.6248 17.1526 15.2559 17.1526 16.0345L15.0623 17.6873L11.5623 18.5623V15.7428H11.3748C10.2702 15.7428 9.37478 14.8474 9.37478 13.7428V13.5553Z"
        fill="#EAE7EA"
      />
    </g>
    <defs>
      <filter
        id="filter0_d_5871_423421"
        x="0"
        y="1"
        width="26"
        height="26"
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
        <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_5871_423421" />
        <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow_5871_423421" result="shape" />
      </filter>
    </defs>
  </svg>
);
