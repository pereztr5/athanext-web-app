import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Pencil, Plus, X } from "@/components/icons";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { BRANDS_QUERY_KEY, coachBrandsQueryKey, useBrands } from "@/hooks/useBrands";
import { brandsAPI } from "@/api/brands";
import {
  BRAND_LOGO_TYPES,
  cleanBrandName,
  filterBrands,
  findBrandByName,
  normalizeBrandWebsite,
  validateBrandLogo,
  type Brand,
} from "@/utils/brands";

interface ManageBrandsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  coachId: string;
  currentBrands: Brand[];
}

interface BrandForm {
  brandId: string | null;
  name: string;
  website: string;
  logoFile: File | null;
  logoPreview: string | null;
}

const emptyForm = (name = ""): BrandForm => ({
  brandId: null,
  name,
  website: "",
  logoFile: null,
  logoPreview: null,
});

function BrandThumb({ brand }: { brand: Pick<Brand, "name" | "logo_url"> }) {
  return (
    <span className="flex h-8 w-14 shrink-0 items-center justify-center rounded-control border border-light-525 bg-light-50">
      {brand.logo_url ? (
        <img src={brand.logo_url} alt="" className="max-h-6 max-w-12 object-contain" />
      ) : (
        <span className="text-label-xsm text-dark-300">{brand.name.slice(0, 2)}</span>
      )}
    </span>
  );
}

export function ManageBrandsDialog({ open, onOpenChange, coachId, currentBrands }: ManageBrandsDialogProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const { isAdmin } = useIsAdmin();
  const queryClient = useQueryClient();
  const { data: allBrands = [] } = useBrands(open);

  const [draft, setDraft] = useState<Brand[]>([]);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState<BrandForm | null>(null);
  const [savingForm, setSavingForm] = useState(false);
  const [saving, setSaving] = useState(false);

  // Start from the saved list each time the dialog opens; later refetches don't reset the draft.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open && !wasOpen.current) {
      setDraft(currentBrands);
      setQuery("");
      setForm(null);
    }
    wasOpen.current = open;
  }, [open, currentBrands]);

  useEffect(() => {
    const preview = form?.logoPreview;
    return () => {
      if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview);
    };
  }, [form?.logoPreview]);

  const draftIds = draft.map((brand) => brand.id);
  const results = filterBrands(allBrands, query, draftIds).slice(0, 8);
  const exactMatch = findBrandByName(allBrands, query);
  const formDuplicate = form ? findBrandByName(allBrands, form.name) : undefined;
  const duplicateOfOther = formDuplicate && formDuplicate.id !== form?.brandId ? formDuplicate : undefined;
  const canEdit = (brand: Brand) => isAdmin || (Boolean(user?.id) && brand.created_by === user?.id);

  const addBrand = (brand: Brand) => {
    setDraft((prev) => (prev.some((b) => b.id === brand.id) ? prev : [...prev, brand]));
    setQuery("");
    setForm(null);
  };

  const moveBrand = (index: number, delta: number) => {
    setDraft((prev) => {
      const next = [...prev];
      const [item] = next.splice(index, 1);
      next.splice(index + delta, 0, item);
      return next;
    });
  };

  const handleLogoChange = (file: File | undefined) => {
    if (!file || !form) return;
    const problem = validateBrandLogo(file);
    if (problem) {
      toast({ title: "Can't use this logo", description: problem, variant: "destructive" });
      return;
    }
    setForm({ ...form, logoFile: file, logoPreview: URL.createObjectURL(file) });
  };

  const handleSaveBrand = async () => {
    if (!form) return;
    const name = cleanBrandName(form.name);
    if (!name) {
      toast({ title: "Brand name required", variant: "destructive" });
      return;
    }
    if (duplicateOfOther) return;
    const website = normalizeBrandWebsite(form.website);
    if (form.website.trim() && !website) {
      toast({ title: "Invalid website", description: "Enter a web address like setgk.com.", variant: "destructive" });
      return;
    }

    try {
      setSavingForm(true);
      const input = { name, website, logoFile: form.logoFile };
      const saved = form.brandId
        ? await brandsAPI.updateBrand(form.brandId, input)
        : await brandsAPI.createBrand(input);
      await queryClient.invalidateQueries({ queryKey: BRANDS_QUERY_KEY });
      if (form.brandId) {
        setDraft((prev) => prev.map((b) => (b.id === saved.id ? saved : b)));
        void queryClient.invalidateQueries({ queryKey: ["coach-brands"] });
        setForm(null);
      } else {
        addBrand(saved);
      }
    } catch (error) {
      toast({
        title: "Could not save brand",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "destructive",
      });
    } finally {
      setSavingForm(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await brandsAPI.setCoachBrands(coachId, draftIds);
      await queryClient.invalidateQueries({ queryKey: coachBrandsQueryKey(coachId) });
      toast({ title: "Organizations updated" });
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Could not save brands",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Manage organizations</DialogTitle>
          <DialogDescription>Organizations and partners you represent. Their logos show near the top of your profile.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          {draft.length === 0 ? (
            <p className="text-body-m text-dark-300">No brands yet.</p>
          ) : (
            draft.map((brand, index) => (
              <div key={brand.id} className="flex items-center gap-3 rounded-control border border-light-525 p-2">
                <BrandThumb brand={brand} />
                <span className="min-w-0 flex-1 truncate text-label-sm text-dark">{brand.name}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  disabled={index === 0}
                  onClick={() => moveBrand(index, -1)}
                  aria-label={`Move ${brand.name} up`}
                >
                  <ArrowUp className="size-4" strokeWidth={1.5} />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  disabled={index === draft.length - 1}
                  onClick={() => moveBrand(index, 1)}
                  aria-label={`Move ${brand.name} down`}
                >
                  <ArrowDown className="size-4" strokeWidth={1.5} />
                </Button>
                {canEdit(brand) ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    onClick={() =>
                      setForm({
                        brandId: brand.id,
                        name: brand.name,
                        website: brand.website ?? "",
                        logoFile: null,
                        logoPreview: brand.logo_url,
                      })
                    }
                    aria-label={`Edit ${brand.name}`}
                  >
                    <Pencil className="size-4" strokeWidth={1.5} />
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  onClick={() => setDraft((prev) => prev.filter((b) => b.id !== brand.id))}
                  aria-label={`Remove ${brand.name}`}
                >
                  <X className="size-4" strokeWidth={1.5} />
                </Button>
              </div>
            ))
          )}
        </div>

        {form ? (
          <div className="flex flex-col gap-3 rounded-control border border-light-525 p-3">
            <p className="text-label-sm text-dark">{form.brandId ? "Edit brand" : "Create new brand"}</p>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="brand-name">Name</Label>
              <Input
                id="brand-name"
                value={form.name}
                maxLength={80}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
              {duplicateOfOther ? (
                <div className="flex items-center justify-between gap-2 text-body-m text-dark-300">
                  <span>“{duplicateOfOther.name}” already exists.</span>
                  {!form.brandId ? (
                    <Button type="button" size="sm" variant="outline" onClick={() => addBrand(duplicateOfOther)}>
                      Add it
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="brand-website">Website (optional)</Label>
              <Input
                id="brand-website"
                value={form.website}
                placeholder="setgk.com"
                onChange={(e) => setForm({ ...form, website: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="brand-logo">Logo</Label>
              <div className="flex items-center gap-3">
                {form.logoPreview ? (
                  <img src={form.logoPreview} alt="Logo preview" className="h-10 w-auto max-w-[140px] object-contain" />
                ) : null}
                <Input
                  id="brand-logo"
                  type="file"
                  accept={BRAND_LOGO_TYPES.join(",")}
                  onChange={(e) => handleLogoChange(e.target.files?.[0])}
                />
              </div>
              <p className="text-caption text-dark-300">PNG, JPG, WebP or SVG, up to 2MB.</p>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setForm(null)} disabled={savingForm}>
                Cancel
              </Button>
              <Button type="button" onClick={handleSaveBrand} disabled={savingForm || Boolean(duplicateOfOther)}>
                {savingForm ? "Saving…" : form.brandId ? "Save brand" : "Create brand"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <Input value={query} placeholder="Search brands" onChange={(e) => setQuery(e.target.value)} />
            {results.map((brand) => (
              <button
                key={brand.id}
                type="button"
                className="flex items-center gap-3 rounded-control p-2 text-left hover:bg-light-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                onClick={() => addBrand(brand)}
              >
                <BrandThumb brand={brand} />
                <span className="min-w-0 flex-1 truncate text-body-m text-dark">{brand.name}</span>
                <Plus className="size-4 text-dark-300" strokeWidth={1.5} />
              </button>
            ))}
            {!exactMatch ? (
              <Button
                type="button"
                variant="outline"
                className="self-start"
                onClick={() => setForm(emptyForm(cleanBrandName(query)))}
              >
                <Plus className="size-4" strokeWidth={1.5} />
                {cleanBrandName(query) ? `Create “${cleanBrandName(query)}”` : "Create new brand"}
              </Button>
            ) : null}
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving || savingForm || Boolean(form)}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
