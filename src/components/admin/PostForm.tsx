import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ImageUpload } from './ImageUpload';
import { SitePost, useCreateSitePost, useUpdateSitePost } from '@/hooks/useSitePosts';
import { Loader2 } from 'lucide-react';

interface PostFormProps {
  post?: SitePost | null;
  mode: 'create' | 'edit';
}

const generateSlug = (title: string): string => {
  return title
    .toLowerCase()
    .replace(/æ/g, 'ae')
    .replace(/ø/g, 'o')
    .replace(/å/g, 'a')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
};

export const PostForm = ({ post, mode }: PostFormProps) => {
  const navigate = useNavigate();
  const createPost = useCreateSitePost();
  const updatePost = useUpdateSitePost();

  const [formData, setFormData] = useState({
    title: '',
    slug: '',
    excerpt: '',
    body: '',
    cover_image_url: null as string | null,
    status: 'draft' as 'draft' | 'published',
    published_at: null as string | null,
  });

  useEffect(() => {
    if (post) {
      setFormData({
        title: post.title,
        slug: post.slug,
        excerpt: post.excerpt || '',
        body: post.body,
        cover_image_url: post.cover_image_url,
        status: post.status,
        published_at: post.published_at,
      });
    }
  }, [post]);

  const handleTitleChange = (title: string) => {
    setFormData(prev => ({
      ...prev,
      title,
      slug: mode === 'create' ? generateSlug(title) : prev.slug,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const data = {
      ...formData,
      published_at: formData.status === 'published' && !formData.published_at 
        ? new Date().toISOString() 
        : formData.published_at,
    };

    if (mode === 'create') {
      await createPost.mutateAsync(data);
    } else if (post) {
      await updatePost.mutateAsync({ id: post.id, ...data });
    }
    
    navigate('/admin/posts');
  };

  const isLoading = createPost.isPending || updatePost.isPending;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div>
            <Label htmlFor="title">Tittel *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => handleTitleChange(e.target.value)}
              required
            />
          </div>

          <div>
            <Label htmlFor="slug">URL-slug *</Label>
            <Input
              id="slug"
              value={formData.slug}
              onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
              required
            />
          </div>

          <div>
            <Label htmlFor="excerpt">Ingress</Label>
            <Textarea
              id="excerpt"
              value={formData.excerpt}
              onChange={(e) => setFormData(prev => ({ ...prev, excerpt: e.target.value }))}
              rows={3}
            />
          </div>

          <div>
            <Label htmlFor="status">Status</Label>
            <Select 
              value={formData.status} 
              onValueChange={(value: 'draft' | 'published') => setFormData(prev => ({ ...prev, status: value }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Utkast</SelectItem>
                <SelectItem value="published">Publisert</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <Label>Forsidebilde</Label>
            <ImageUpload
              value={formData.cover_image_url}
              onChange={(url) => setFormData(prev => ({ ...prev, cover_image_url: url }))}
              folder="posts"
            />
          </div>
        </div>
      </div>

      <div>
        <Label htmlFor="body">Innhold *</Label>
        <Textarea
          id="body"
          value={formData.body}
          onChange={(e) => setFormData(prev => ({ ...prev, body: e.target.value }))}
          rows={15}
          required
          placeholder="Skriv innholdet her... (Markdown støttes)"
        />
      </div>

      <div className="flex gap-4">
        <Button type="submit" disabled={isLoading}>
          {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {mode === 'create' ? 'Opprett innlegg' : 'Lagre endringer'}
        </Button>
        <Button type="button" variant="outline" onClick={() => navigate('/admin/posts')}>
          Avbryt
        </Button>
      </div>
    </form>
  );
};
