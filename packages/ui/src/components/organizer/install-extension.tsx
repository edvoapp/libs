import styled from 'styled-components';
import GoogleChrome from '../../assets/icons/google-chrome';
import { config } from '@edvoapp/common';

const InstallExtensionSC = styled.div`
  flex: 1 0 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
`;

const Title = styled.div`
  font-family: 'Red Hat Display';
  font-style: normal;
  font-weight: 600;
  font-size: 20px;
  line-height: 120%;
  max-width: 80%;
  color: #000000;
  margin-bottom: 4px;
`;
const Subtitle = styled.div`
  font-family: 'Red Hat Display';
  font-style: normal;
  font-weight: 600;
  font-size: 16px;
  line-height: 120%;
  max-width: 80%;
  color: #a89fab;
  margin-bottom: 60px;
`;

const CTA = styled.div`
  font-family: 'Red Hat Display';
  font-style: normal;
  font-weight: 600;
  font-size: 28px;
  line-height: 140%;
  max-width: 80%;
  text-align: center;
  color: #1f1c20;
  margin-bottom: 32px;
`;

const Button = styled.button`
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: center;
  padding: 12px 20px;
  gap: 12px;
  background: #783df6;
  box-shadow: 0px 0px 10px rgba(10, 8, 11, 0.2);
  backdrop-filter: blur(15px);
  border-radius: 8px;

  font-family: 'Red Hat Display';
  font-style: normal;
  font-weight: 600;
  font-size: 16px;
  line-height: 21px;
  color: #ffffff;
  margin-bottom: 190px;

  svg {
    margin-right: 12px;
  }
`;

const SubThingy = styled.div`
  font-family: 'Red Hat Display';
  font-style: normal;
  font-weight: 600;
  font-size: 12px;
  line-height: 130%;
  text-align: center;
  color: #a89fab;
`;

export const InstallExtension = () => {
  return (
    <InstallExtensionSC>
      <Title>Edvo Organizer</Title>
      <Subtitle>Work 3X faster</Subtitle>
      <CTA>You are 2 clicks away from breaking out of tab hell🕺🏼</CTA>
      <Button as="a" href={config.extensionURL} target="_blank">
        <GoogleChrome width={24} height={24} />
        <span>Add to Chrome</span>
      </Button>
      <SubThingy>Extension not working? Try refreshing this page, or removing and reinstalling it</SubThingy>
    </InstallExtensionSC>
  );
};
