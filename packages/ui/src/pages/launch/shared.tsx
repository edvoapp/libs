import styled, { css } from 'styled-components';

export const Root = styled.div`
  font-family: 'Inter', sans-serif;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  color: #333;
  text-align: center;
`;

export const Container = styled.div``;

export const Heading = styled.h1`
  font-size: 24px;
  margin-bottom: 20px;
`;

export const Footer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: fixed;
  width: 75vw;
  bottom: 10vh;
  padding-top: 100px;
  border-top: solid 1px #e4e4e7;
`;

export const Paragraph = styled.p`
  font-size: 16px;
  margin-bottom: 40px;
  color: #555;
`;

export const Link = styled.a`
  color: #007bff;
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
`;

export const Button = styled.a<{ outline?: boolean; marginTop?: number }>`
  display: flex;
  justify-content: center;
  align-items: center;
  align-self: center;
  border-radius: 8px;
  ${(props) =>
    props.outline
      ? css`
          color: #783df6;
          background: white;
          border: solid 1px #783df6;
        `
      : css`
          background: #783df6;
          color: white;
        `}
  padding: 12px 36px;
  font-size: 16px;
  font-style: normal;
  font-weight: 600;
  line-height: normal;
  margin-top: ${(props) => `${props.marginTop ?? 0}px`};
`;
