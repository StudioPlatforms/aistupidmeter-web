import Link from 'next/link';
import { ReadingPage, RdSection, RdProse, tocNumber } from '@/components/landing/Reading';
import { marketplaceStaffGate, providerPageMetadata } from '@/lib/provider-gate';

/**
 * "Logo standards v1" (Phase 3 plan §3.1): the rules every provider's mark meets. Shown to staff
 * from M3 and published for everyone with the opening (M10), when it is also attached to the
 * Provider Terms and Listing Agreement as Annex C; a change to it is a change to the agreement. Items 1–13 are the
 * plan's text word for word, grouped into five sections for reading, except item 5's measurement:
 * the processor measures ink and colour on the framed 12 px render (the chip), so the page says so
 * and gives the ranges our seven marks measure there (M3 dossier §4 decision 10, §5.1), not the
 * plan's unframed-canvas numbers.
 *
 * Until then: only accounts the API lets into the provider pages see it (the provider pages' own
 * door, GET /account/provider); everyone else, signed out included, gets the site's 404. Never
 * indexed, and not in the sitemap (lib/seo-routes.ts) or any navigation.
 */

const PATH = '/inference-providers/logo-standards';
// The page's lead, and from the opening its description too (fix round, code review m9: the same words, nothing new).
const LEAD = "The square icon mark shown beside a provider's name on AI Stupid Level: what we accept, how we check it, and how review works.";

export const generateMetadata = providerPageMetadata(PATH, 'Logo standards v1', LEAD);

/** Per account: the API decides who may read it until it is public. */
export const dynamic = 'force-dynamic';

const TOC = [
  { id: 'mark', label: 'Your mark' },
  { id: 'file', label: 'The file' },
  { id: 'legibility', label: 'Size, colour and style' },
  { id: 'review', label: 'Content and review' },
  { id: 'processing', label: 'Processing and rights' },
];
const n = (id: string) => tocNumber(TOC, id);

const arrow = <span className="lp-ar" aria-hidden="true">→</span>;

export default async function LogoStandardsPage() {
  const { preview } = await marketplaceStaffGate(PATH);

  return (
    <ReadingPage
      className="rd-logo-standards"
      kicker="For inference providers"
      title="Logo standards"
      accent="v1"
      lead={LEAD}
      actions={(
        <Link className="lp-btn lp-btn-primary lp-btn-lg" href="/account/provider/logo">Upload your logo {arrow}</Link>
      )}
      note={preview ? 'Not public yet: only staff accounts can open this page.' : undefined}
      toc={TOC}
    >
      <RdSection id="mark" n={n('mark')} title="Your mark">
        <RdProse>
          <p><b>1. What we show.</b> One square icon mark: a symbol or a monogram on a transparent background. Never a wordmark, an app-icon plate, a slogan, a badge, a screenshot or a photo. We set your name next to it in our own type. An app icon&apos;s filled plate would show as a coloured square on our white tile.</p>
          <p><b>2. Where it appears and how big.</b> Always on a white tile (#FFFFFF, with a 1 px hairline border and rounded corners, or a round chip), in the light theme and in the dark theme alike, exactly as the OpenAI, Anthropic and Google marks appear today. We draw your mark at about 60% of the tile:</p>
          <ul>
            <li>the smallest chips: 20 px tiles with 12 px marks, 22 px round chips with 13 px marks, and 24 px round chips without a border. Round chips crop the corners;</li>
            <li>leaderboard and list chips: 20–34 px tiles, so your mark appears at 12–20 px;</li>
            <li>app chips: 24–40 px tiles (14–24 px marks);</li>
            <li>your provider page header: a 64 px tile (40 px mark);</li>
            <li>the share card: a 120 px tile (72 px mark).</li>
          </ul>
        </RdProse>
      </RdSection>

      <RdSection id="file" n={n('file')} title="The file">
        <RdProse>
          <p><b>3. The file: SVG only.</b> We do not accept PNG, JPEG or any other image format.</p>
          <ul>
            <li>A square <code>viewBox</code> whose width and height are exactly equal. We recommend <code>0 0 24 24</code>, which all of our own marks use. <code>width</code>, <code>height</code> and <code>style</code> on the root element are ignored.</li>
            <li>At most 16 KB, at most 200 elements, nested at most 8 deep, each path&apos;s <code>d</code> at most 12 KB, and every number finite and within ±1,000,000.</li>
            <li>Allowed elements: <code>svg</code>, <code>g</code>, <code>path</code>, <code>rect</code>, <code>circle</code>, <code>ellipse</code>, <code>line</code>, <code>polyline</code>, <code>polygon</code>, <code>defs</code>, <code>linearGradient</code>, <code>stop</code>, and <code>clipPath</code> holding exactly one <code>rect</code>. <code>title</code> and <code>desc</code> are removed.</li>
            <li>Allowed attributes: geometry (<code>d</code>, <code>x</code>, <code>y</code>, <code>width</code>, <code>height</code>, <code>cx</code>, <code>cy</code>, <code>r</code>, <code>rx</code>, <code>ry</code>, <code>x1</code>, <code>y1</code>, <code>x2</code>, <code>y2</code>, <code>points</code>, <code>offset</code>); <code>viewBox</code>, <code>preserveAspectRatio</code>, <code>transform</code>, <code>gradientUnits</code>, <code>gradientTransform</code>, <code>spreadMethod</code>; paint (<code>fill</code>, <code>fill-rule</code>, <code>fill-opacity</code>, <code>stroke</code>, <code>stroke-width</code>, <code>stroke-linecap</code>, <code>stroke-linejoin</code>, <code>stroke-miterlimit</code>, <code>stroke-dasharray</code>, <code>stroke-dashoffset</code>, <code>stroke-opacity</code>, <code>opacity</code>, <code>stop-color</code>, <code>stop-opacity</code>); <code>clip-path</code>, <code>clip-rule</code>, <code>id</code>, <code>xmlns</code>, <code>version</code>.</li>
            <li>Every <code>style</code> attribute is removed, without a refusal, and the check report says how many were (our own marks carry <code>style=&quot;flex:none;line-height:1&quot;</code>). Paint set inside a <code>style</code> attribute is therefore lost, and the preview shows it: set paint as attributes.</li>
            <li>Paint and clip references must be <code>url(#id)</code> pointing at an element in the same file. No <code>href</code> or <code>xlink:href</code> anywhere.</li>
            <li>Not accepted: <code>&lt;style&gt;</code> sheets, <code>mask</code>, <code>radialGradient</code>, <code>filter</code>, <code>image</code>, <code>text</code>, <code>foreignObject</code>, <code>use</code>, <code>a</code>, <code>script</code>, animation elements, event attributes, references outside the file, processing instructions, DOCTYPE and entity declarations.</li>
          </ul>
          <p><b>4. Safe area.</b> Draw your mark edge to edge, with no padding of your own and no background shape.</p>
          <ul>
            <li>A mark that covers 90% or more of its canvas with opaque paint is refused: the white tile is the background.</li>
            <li>We trim transparent edges (opacity below 16 of 255).</li>
            <li>We then centre the mark with clear space of 1/16 of the side on every side, so every mark on the site has the same optical size.</li>
            <li>After trimming, width to height must stay between 1:2 and 2:1.</li>
          </ul>
        </RdProse>
      </RdSection>

      <RdSection id="legibility" n={n('legibility')} title="Size, colour and style">
        <RdProse>
          <p><b>5. Small sizes.</b> Your mark must stay recognisable at 12 px, the size of our smallest chips. We render it at 12 px as it appears in a chip, framed with the clear space of item 4, and measure that render. Our own marks pass:</p>
          <ul>
            <li><b>ink:</b> the mark&apos;s average opacity over the 12 × 12 px square is at least 12% (our seven marks: 13.5–32.2%);</li>
            <li><b>colour:</b> at least half of its visible pixels have a colour with a contrast of 3:1 or more against #FFFFFF, the WCAG non-text contrast (our marks: 72.2–100%).</li>
            <li>Strokes thinner than 1/48 of the side, and text smaller than a quarter of the side, disappear at that size. Monograms work well. A person still decides.</li>
          </ul>
          <p><b>6. Light and dark.</b> The tile is white in both themes, so your mark must read on white. The colour measure in item 5 refuses white or very light marks made for dark backgrounds: upload your dark or full-colour version. We never use a separate dark variant.</p>
          <p><b>7. Style.</b> Flat colours, or simple linear gradients: at most 4 distinct colours, counting every gradient stop, at most 3 linear gradients, and no radial gradient. Colours are counted as #rrggbb values, ignoring opacity; a shape with no fill counts as black. Our own Google mark (4 colours, 3 linear gradients) is the most we accept. No glow, outer shadow, bevel, 3D, neon or blur. A mark whose overall opacity is below 50% is refused.</p>
        </RdProse>
      </RdSection>

      <RdSection id="review" n={n('review')} title="Content and review">
        <RdProse>
          <p><b>8. Content, checked by a person.</b></p>
          <ul>
            <li>Only your own company&apos;s current mark, matching the company named in your listing and your verified domain.</li>
            <li>Not the mark of a model maker (Meta Llama, Qwen, Mistral, DeepSeek, Gemma and others) unless you are that company, and not ours.</li>
            <li>No claims (&quot;#1&quot;, &quot;Best&quot;, &quot;Fastest&quot;, &quot;Official&quot;, &quot;Partner&quot;, &quot;Certified&quot;, &quot;Approved&quot;), scores, ranks or medals.</li>
            <li>No URLs or QR codes, no flags used as a logo, no political or religious symbols, no faces, nothing sexual, violent, offensive or misleading, and no hidden or near-invisible content.</li>
          </ul>
          <p><b>9. Limits.</b> One approved mark at a time, and 10 uploads per provider per day. A replacement goes to review, and your current mark stays live until the new one is approved.</p>
          <p><b>10. Review.</b> A person at AI Stupid Level reviews every new or replaced mark before it is public; until then we show your initials. A refusal always comes with its reason, and you can upload again.</p>
        </RdProse>
      </RdSection>

      <RdSection id="processing" n={n('processing')} title="Processing and rights">
        <RdProse>
          <p><b>11. Processing and privacy.</b> We never serve your file as you uploaded it, and never place it inside any page.</p>
          <ul>
            <li>We clean it, render it in an isolated sandbox, and serve PNGs at 64, 128, 256 and 512 px, without any metadata, from aistupidlevel.info under an address that changes with the content.</li>
            <li>We keep our cleaned-up copy for later re-drawing, and delete your original 30 days after the review decision.</li>
          </ul>
          <p><b>12. Trademark complaints.</b> If someone shows, through their own verified domain, that a mark is theirs, we hide the disputed mark while we review it, and tell both sides why.</p>
        </RdProse>
      </RdSection>
    </ReadingPage>
  );
}
