import styled from 'styled-components';
import { GoogleChrome } from '../../assets/icons/google-chrome';
import { config } from '@edvoapp/common';

const Root = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  flex: 1 0 0;
  background: #1118271a;
  height: 100vh;
  width: 100vw;
`;

const Container = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;

  color: #18181b;
  text-align: center;
  font-family: Inter, sans-serif;
  font-style: normal;
  max-width: 550px;
`;

const H1 = styled.h1`
  font-size: 48px;
  font-weight: 600;
  line-height: 150%; /* 72px */
  letter-spacing: 0.48px;
  margin-bottom: 24px;
`;

const P = styled.p`
  font-size: 18px;
  font-weight: 500;
  line-height: 150%; /* 27px */
  letter-spacing: 0.18px;
  margin-bottom: 72px;
`;

const Button = styled.a`
  text-underline: none;
  cursor: pointer;
  outline: none;
  padding: 12px 16px;
  display: flex;
  align-items: center;

  border-radius: 3px;
  border-top: 1px solid rgba(17, 24, 39, 0.1);
  border-right: 1px solid rgba(17, 24, 39, 0.1);
  border-left: 1px solid rgba(17, 24, 39, 0.1);
  background: #5d34d7;
  box-shadow: 0px 2.76726px 2.21381px 0px rgba(0, 0, 0, 0.02), 0px 6.6501px 5.32008px 0px rgba(0, 0, 0, 0.03),
    0px 12.52155px 10.01724px 0px rgba(0, 0, 0, 0.04), 0px 22.33631px 17.86905px 0px rgba(0, 0, 0, 0.04),
    0px 41.77761px 33.42209px 0px rgba(0, 0, 0, 0.05), 0px 100px 80px 0px rgba(0, 0, 0, 0.07);

  color: #fff;
  font-size: 18px;
  font-weight: 500;
  line-height: 150%; /* 27px */
  letter-spacing: 0.18px;
`;

export const DownloadExtension = () => {
  return (
    <Root>
      <Container>
        <H1>Edvo Extension</H1>
        <P>
          The Edvo Chrome Extension lets you quickly move your Chrome tabs into Edvo spaces via simple drag and drop.
        </P>
        <Button href={config.extensionURL} target="_blank">
          <GoogleChrome width={24} height={24} style={{ marginRight: 12 }} />
          Install Chrome Extension
        </Button>
      </Container>
    </Root>
  );
};
