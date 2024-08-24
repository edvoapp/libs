const url = 'https://plm-annotator-outer-staging.web.app/annotator-injector-outer-bundle.js';
const bookmarkletHref = `javascript:(function (){document.getElementsByTagName('head')[0].appendChild(document.createElement('script')).src='${url}'}());`;

export function Bookmarklet() {
  return (
    <section>
      Click and drag this to your bookmarks toolbar:
      <a
        style={{
          textDecoration: 'none',
          background: 'white',
          border: '1px solid #ccc',
          color: '#6E6C74',
          padding: '0.25em 0.5em',
          borderRadius: '10px',
          cursor: 'pointer',
          display: 'flex',
        }}
        href={bookmarkletHref}
        onClick={(e) => e.preventDefault()}
      >
        Inject Personal Learning
      </a>
    </section>
  );
}
