/**
 * Brands and coach brand links (ATH-56).
 * brands / coach_brands are publicly readable; coaches create brands and manage their own links,
 * and only a brand's creator or an admin can edit it (RLS). Tables aren't in the generated types yet.
 */
import { supabase } from '@/integrations/supabase/client';
import { cleanBrandName, findBrandByName, type Brand } from '@/utils/brands';

const BRAND_COLUMNS = 'id, name, logo_url, website, created_by';
const db = supabase as any;

export interface BrandInput {
  name: string;
  website: string | null;
  logoFile?: File | null;
}

async function uploadBrandLogo(file: File): Promise<string> {
  const ext = file.type === 'image/svg+xml' ? 'svg' : file.name.split('.').pop() || 'png';
  const filePath = `brands/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from('athalink-images')
    .upload(filePath, file, { cacheControl: '3600', upsert: false, contentType: file.type });
  if (error) throw new Error(error.message);
  return supabase.storage.from('athalink-images').getPublicUrl(filePath).data.publicUrl;
}

export const brandsAPI = {
  async listBrands(): Promise<Brand[]> {
    const { data, error } = await db.from('brands').select(BRAND_COLUMNS).order('name').limit(1000);
    if (error) throw error;
    return (data as Brand[]) || [];
  },

  /** Creates a brand, or returns the existing one when the name is already taken. */
  async createBrand(input: BrandInput): Promise<Brand> {
    const name = cleanBrandName(input.name);
    const logo_url = input.logoFile ? await uploadBrandLogo(input.logoFile) : null;
    const { data, error } = await db
      .from('brands')
      .insert({ name, website: input.website, logo_url })
      .select(BRAND_COLUMNS)
      .single();
    if (error?.code === '23505') {
      const existing = findBrandByName(await brandsAPI.listBrands(), name);
      if (existing) return existing;
    }
    if (error) throw error;
    return data as Brand;
  },

  async updateBrand(id: string, input: BrandInput): Promise<Brand> {
    const changes: Record<string, string | null> = {
      name: cleanBrandName(input.name),
      website: input.website,
    };
    if (input.logoFile) changes.logo_url = await uploadBrandLogo(input.logoFile);
    const { data, error } = await db
      .from('brands')
      .update(changes)
      .eq('id', id)
      .select(BRAND_COLUMNS)
      .single();
    if (error) throw error;
    return data as Brand;
  },

  async getCoachBrands(coachId: string): Promise<Brand[]> {
    const { data, error } = await db
      .from('coach_brands')
      .select(`display_order, brand:brands(${BRAND_COLUMNS})`)
      .eq('coach_id', coachId)
      .order('display_order')
      .order('created_at');
    if (error) throw error;
    return ((data as { brand: Brand | null }[]) || []).map((row) => row.brand).filter(Boolean) as Brand[];
  },

  /** Replaces the coach's brands with brandIds, in that display order. */
  async setCoachBrands(coachId: string, brandIds: string[]): Promise<void> {
    let removal = db.from('coach_brands').delete().eq('coach_id', coachId);
    if (brandIds.length > 0) removal = removal.not('brand_id', 'in', `(${brandIds.join(',')})`);
    const { error: deleteError } = await removal;
    if (deleteError) throw deleteError;
    if (brandIds.length === 0) return;

    const { error } = await db.from('coach_brands').upsert(
      brandIds.map((brand_id, index) => ({ coach_id: coachId, brand_id, display_order: index })),
      { onConflict: 'coach_id,brand_id' }
    );
    if (error) throw error;
  },
};
