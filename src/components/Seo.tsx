import { Helmet } from 'react-helmet-async';

const SITE_URL = 'https://fagerborgbk.no';

interface SeoProps {
  /** Unique page title, ideally under 60 characters */
  title: string;
  /** Unique description, 50-160 characters */
  description: string;
  /** Route path, e.g. "/kamper" */
  path: string;
  /** Absolute image URL for social previews */
  image?: string;
  type?: 'website' | 'article';
  noindex?: boolean;
  /** Optional JSON-LD structured data for this page */
  jsonLd?: Record<string, unknown>;
}

const Seo = ({ title, description, path, image, type = 'website', noindex, jsonLd }: SeoProps) => {
  const url = `${SITE_URL}${path}`;

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      {noindex && <meta name="robots" content="noindex, nofollow" />}

      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:type" content={type} />
      {image && <meta property="og:image" content={image} />}

      <meta name="twitter:title" content={title} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:description" content={description} />
      {image && <meta name="twitter:image" content={image} />}

      {jsonLd && (
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      )}
    </Helmet>
  );
};

export default Seo;