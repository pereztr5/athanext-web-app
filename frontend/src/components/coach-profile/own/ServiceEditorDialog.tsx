/** Add or edit a session type (Working Copy `AN.modals.svc`). The base 1-on-1 row can't be deleted. */
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BASE_SERVICE_ID, type ProfileService, type ProfileServiceFormat } from "@/api/coachProfile";
import { dialogContent, input, label, primaryButton, secondaryButton, segButton, segGroup, textButton } from "@/components/schedule/styles";
import { cn } from "@/lib/utils";

const LENGTHS = [30, 45, 60, 90];
const WHERE = ["In person", "Video call", "In person or video call"];

export const ServiceEditorDialog = ({
  service,
  onClose,
  onSave,
  onDelete,
}: {
  /** null: closed. id "new": adding. */
  service: ProfileService | null;
  onClose: () => void;
  onSave: (next: ProfileService) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
}) => {
  const [name, setName] = useState("");
  const [format, setFormat] = useState<ProfileServiceFormat>("individual");
  const [minutes, setMinutes] = useState(60);
  const [price, setPrice] = useState("");
  const [where, setWhere] = useState(WHERE[0]);
  const [errors, setErrors] = useState<{ name?: string; price?: string }>({});
  const [saving, setSaving] = useState(false);
  const isNew = service?.id === "new";
  const isBase = service?.id === BASE_SERVICE_ID;

  useEffect(() => {
    if (!service) return;
    setName(service.name);
    setFormat(service.format);
    setMinutes(service.minutes);
    setPrice(service.price ? String(service.price) : "");
    setWhere(WHERE.includes(service.where) ? service.where : WHERE[0]);
    setErrors({});
  }, [service]);

  const save = async () => {
    const amount = Number(price);
    const next = { name: name.trim() ? "" : "Name the session type", price: price !== "" && amount >= 0 && amount <= 10000 ? "" : "Enter a price" };
    if (next.name || next.price) {
      setErrors({ name: next.name || undefined, price: next.price || undefined });
      return;
    }
    if (!service) return;
    setSaving(true);
    const ok = await onSave({ ...service, id: isNew ? `svc-${Date.now()}` : service.id, name: name.trim(), format: isBase ? "individual" : format, minutes, price: amount, where });
    setSaving(false);
    if (ok) onClose();
  };

  const remove = async () => {
    if (!service) return;
    setSaving(true);
    const ok = await onDelete(service.id);
    setSaving(false);
    if (ok) onClose();
  };

  return (
    <Dialog open={Boolean(service)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className={dialogContent}>
        <DialogHeader className="px-[25px] pb-4 pt-5 pr-14 text-left">
          <DialogTitle className="text-section">{isNew ? "Add session type" : "Edit session type"}</DialogTitle>
        </DialogHeader>
        <form
          className="flex flex-col gap-4 px-[25px] pb-5"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <label className="flex flex-col gap-1.5">
            <span className={label}>Name</span>
            <input
              className={cn(input, errors.name && "border-error-600")}
              placeholder="For example, Finishing clinic"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            {errors.name ? <span className="text-caption text-error-700">{errors.name}</span> : null}
          </label>
          {!isBase ? (
            <div className="flex flex-col gap-1.5">
              <span className={label}>Format</span>
              <div className={segGroup} role="radiogroup" aria-label="Format">
                {(["individual", "group"] as const).map((f) => (
                  <button key={f} type="button" role="radio" aria-checked={format === f} className={segButton(format === f)} onClick={() => setFormat(f)}>
                    {f === "individual" ? "Individual" : "Group"}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className={label}>Length</span>
              <select className={input} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}>
                {(LENGTHS.includes(minutes) ? LENGTHS : [...LENGTHS, minutes].sort((a, b) => a - b)).map((m) => (
                  <option key={m} value={m}>
                    {m} min
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={label}>{format === "group" && !isBase ? "Price per athlete" : "Price"}</span>
              <span className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-body-m text-dark-300">$</span>
                <input
                  className={cn(input, "pl-6", errors.price && "border-error-600")}
                  type="number"
                  min={0}
                  inputMode="decimal"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                />
              </span>
              {errors.price ? <span className="text-caption text-error-700">{errors.price}</span> : null}
            </label>
          </div>
          <label className="flex flex-col gap-1.5">
            <span className={label}>Where</span>
            <select className={input} value={where} onChange={(e) => setWhere(e.target.value)}>
              {WHERE.map((w) => (
                <option key={w}>{w}</option>
              ))}
            </select>
          </label>
          <p className="text-caption text-dark-300">
            {isBase ? "Price and place save when you press Done. " : ""}Price changes apply to new bookings. Existing bookings keep their price.
          </p>
          <div className="flex items-center justify-end gap-2">
            {!isNew && !isBase ? (
              <button type="button" className={cn(textButton, "mr-auto text-error-700")} disabled={saving} onClick={() => void remove()}>
                Delete
              </button>
            ) : null}
            <button type="button" className={secondaryButton} onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className={primaryButton} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
