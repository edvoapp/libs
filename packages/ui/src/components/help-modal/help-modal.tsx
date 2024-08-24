import { useObserveValue } from '@edvoapp/util';
import * as VM from '../../viewmodel';
import { createPortal, forwardRef, useEffect, useRef } from 'preact/compat';
import styled from 'styled-components';
import { ComponentChild, RefObject, Ref } from 'preact';
import './help-modal.scss';
import { Button } from '../button/button';
import { CloseIcon } from '../icons';
import { MODAL_PANEL_Z } from '../../constants';

interface Props {
  node: VM.HelpModal;
}

export const HelpModalRoot = styled.div`
  position: fixed;
  top: 50%;
  left: 50%;
  z-index: ${MODAL_PANEL_Z[0]};
  width: 800px;
  // height: 560px;
  transform: translateX(-50%) translateY(-50%);

  display: flex;
  flex-direction: column;
  // justify-content: center;
  align-items: center;
  // font-size: 2rem;

  border-radius: 3px;
  border: 1px solid rgba(17, 24, 39, 0.1);
  background: white;
  background-blend-mode: overlay, normal;

  box-shadow: 0px 4px 16px 0px rgba(0, 0, 0, 0.1);
`;

export const HelpModal = ({ node }: Props) => {
  const anchorButtons = useObserveValue(() => node.anchorButtons, [node]);

  return createPortal(
    <>
      <div
        className="overlay top-0 left-0 w-screen h-screen pointer-events-none bg-black/40 fixed"
        style={{ zIndex: MODAL_PANEL_Z[0] - 1 }}
      ></div>
      <HelpModalRoot className="help-modal" ref={(r: HTMLElement | null) => node.safeBindDomElement(r)}>
        <div className="flex items-center px-6 py-4 w-full justify-between">
          <h1 className="font-semibold">Edvo How To's</h1>
          <Button node={node.closeButton} toolTip="Close">
            <CloseIcon />
          </Button>
        </div>
        <div className="horizontal-line h-px bg-[#E4E4E7] w-[750px] mb-6"></div>
        <div className="w-full flex h-[525px]">
          <div className="navigation flex flex-col min-w-[240px]">
            <ul>
              {anchorButtons.map((node, index) => (
                <li key={node.key}>
                  <div className="pl-6 py-2 text-sm w-full">
                    <AnchorButton node={node} section={index + 1}>
                      <span className="inline-block w-[22px] mr-2">{(index + 1).toString().padStart(2, '0')}.</span>
                      <span>{node.section}</span>
                    </AnchorButton>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <Section node={node.section} />
        </div>
      </HelpModalRoot>
    </>,
    document.body,
  );
};

const AnchorButton = ({
  node,
  section,
  children,
}: {
  node: VM.AnchorButton;
  section: number;
  children: ComponentChild;
}) => {
  const isSelected = useObserveValue(() => node.selected, [node]);

  return (
    <button
      ref={(r: HTMLButtonElement | null) => node.safeBindDomElement(r)}
      key={node.key}
      className={`anchor-button ${isSelected ? 'font-semibold' : 'font-light'}`}
      data-target={`section-${section}`}
    >
      {children}
    </button>
  );
};

const Section = ({ node }: { node: VM.Section }) => {
  const observerRef = useRef<IntersectionObserver | null>();
  const sectionRefs = useRef<Array<React.RefObject<HTMLDivElement>>>([]);
  sectionRefs.current = node.sections.map(() => useRef(null));

  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            // Extract section number from the ID
            const sectionNumber = entry.target.id.split('-').pop();
            const sectionTitle = node.sections[parseInt(sectionNumber!, 10) - 1];
            node.setCurrentSection(sectionTitle); // Update the ViewModel's current section
          }
        });
      },
      {
        root: document.querySelector('#scrollable-section'),
        rootMargin: '0px 0px -100px 0px',
        threshold: 1,
      },
    );

    sectionRefs.current.forEach((ref) => {
      if (ref && ref.current) observerRef.current?.observe(ref.current);
    });

    return () => {
      if (observerRef.current) {
        sectionRefs.current.forEach((ref) => {
          if (ref && ref.current) observerRef.current?.unobserve(ref.current);
        });
      }
    };
  }, []);

  return (
    <div
      ref={(r) => node.safeBindDomElement(r)}
      className="scrollable-section flex flex-col overflow-y-auto gap-[72px]"
      id="scrollable-section"
    >
      <div id="section-1" className="flex flex-col px-6 gap-6 pt-1">
        <SectionTitle node={node.sectionTitle.value[0]} ref={sectionRefs.current[0]} index={0} />
        <span>Press ⌘K, enter the space name, and select "Create space" at the bottom of the dialogue.</span>
        <video autoPlay loop muted playsInline style="width:100%; height:auto;">
          <source src="/01-Create-a-new-space.mp4" type="video/mp4"></source>
          Your browser does not support the video tag.
        </video>
      </div>
      <div id="section-2" className="flex flex-col px-6 gap-6">
        <SectionTitle node={node.sectionTitle.value[1]} ref={sectionRefs.current[1]} index={1} />
        <span>
          From your toolbar's tabs list, drag and drop any tab into your space, or just paste any URL directly into the
          space.
        </span>
        <video autoPlay loop muted playsInline style="width:100%; height:auto;">
          <source src="/02-Bring-in-browser-tabs.mp4" type="video/mp4"></source>
          Your browser does not support the video tag.
        </video>
      </div>
      <div id="section-3" className="flex flex-col px-6 gap-6">
        <SectionTitle node={node.sectionTitle.value[2]} ref={sectionRefs.current[2]} index={2} />
        <span>
          Either click on the Upload icon located in the toolbar or directly drag and drop the file into your space.
        </span>
        <video autoPlay loop muted playsInline style="width:100%; height:auto;">
          <source src="/03-Bring-in-files.mp4" type="video/mp4"></source>
          Your browser does not support the video tag.
        </video>
      </div>
      <div id="section-4" className="flex flex-col px-6 gap-6">
        <SectionTitle node={node.sectionTitle.value[3]} ref={sectionRefs.current[3]} index={3} />
        <span>
          Press ⌘K and type the name of the item or space you're searching for. When you find your desired result in the
          search outcomes, click on it to navigate there.
        </span>
        <video autoPlay loop muted playsInline style="width:100%; height:auto;">
          <source src="/04-Search-or-switch-spaces.mp4" type="video/mp4"></source>
          Your browser does not support the video tag.
        </video>
      </div>
      <div id="section-5" className="flex flex-col px-6 gap-6">
        <SectionTitle node={node.sectionTitle.value[4]} ref={sectionRefs.current[4]} index={4} />
        <span>
          To group items, start by creating a portal from the toolbar. Then, drag items into your newly created portal.
          To alter portal appearance later you can switch from Portal to List view.
        </span>
        <video autoPlay loop muted playsInline style="width:100%; height:auto;">
          <source src="/05-Group-things.mp4" type="video/mp4"></source>
          Your browser does not support the video tag.
        </video>
      </div>
      <div id="section-6" className="flex flex-col px-6 gap-6">
        <SectionTitle node={node.sectionTitle.value[5]} ref={sectionRefs.current[5]} index={5} />
        <span>Click on your profile located at the upper right corner of the screen. Select "App Settings."</span>
        <video autoPlay loop muted playsInline style="width:100%; height:auto;">
          <source src="/06-Optimize-canvas-settings.mp4" type="video/mp4"></source>
          Your browser does not support the video tag.
        </video>
        <span>Then adjust the “Canvas Settings” according to your preferences.</span>
      </div>
      <div id="section-7" className="flex flex-col px-6 gap-6 mb-6">
        <SectionTitle node={node.sectionTitle.value[6]} ref={sectionRefs.current[6]} index={6} />
        <span>Having issues moving around your space using a trackpad?</span>
        <video autoPlay loop muted playsInline style="width:100%; height:auto;">
          <source src="/07-Troubleshooting.mp4" type="video/mp4"></source>
          Your browser does not support the video tag.
        </video>
        <span>Go to your Mac Settings &#45;&#45;&gt; Trackpad &#45;&#45;&gt; Turn Swipe between pages off</span>
      </div>
    </div>
  );
};

interface SectionTitleProps {
  node: VM.SectionTitle;
  index: number;
}

const SectionTitle = forwardRef<HTMLElement, SectionTitleProps>(({ node, index }, ref) => {
  return (
    <span
      ref={(r) => {
        if (typeof ref === 'function') {
          ref(r);
        } else if (ref) {
          ref.current = r;
        }
        node.safeBindDomElement(r);
      }}
      className="text-2xl font-semibold"
      id={`section-title-${index + 1}`}
    >
      {node.text}
    </span>
  );
});
