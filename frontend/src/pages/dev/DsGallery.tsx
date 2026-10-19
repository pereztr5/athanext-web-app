// Dev-only gallery of the design system primitives (route /__ds, never built for production).
import { useState } from "react"
import { CalendarPlus, MessageCircle, Plus } from "@/components/icons"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { BrandPill, type BrandPillTone } from "@/components/brand"
import { PageHeader } from "@/components/ui/page-header"
import { Banner } from "@/components/ui/banner"
import { Placeholder, Stat } from "@/components/ui/stat"

const TONES: BrandPillTone[] = ["blue", "teal", "neutral", "sunk", "green", "amber", "red", "solid", "muted"]

export default function DsGallery() {
  const { toast } = useToast()
  const [on, setOn] = useState(true)
  return (
    <div className="min-h-screen bg-light px-4 py-6">
      <div className="mx-auto flex max-w-wrapper flex-col gap-6">
        <PageHeader
          back={{ label: "My schedule", to: "/__ds" }}
          title="Design system"
          subtitle="Every primitive in its states. Dev only."
          actions={
            <>
              <Button variant="secondary"><MessageCircle />Message</Button>
              <Button><CalendarPlus />Book a session</Button>
            </>
          }
        />
        <div className="grid gap-6 md:grid-cols-3">
          <Card className="p-[25px] pt-[30px]"><Stat label="Earned last 7 days" value="$1,240" meta="4 more sessions than last week" trend="up" /></Card>
          <Card className="p-[25px] pt-[30px]"><Stat label="Sessions this week" value="9" meta="9 of 14 weekly slots booked" /></Card>
          <Card className="p-[25px] pt-[30px]"><Stat label="Overdue" value="$180" meta="2 invoices past due" trend="down" /></Card>
        </div>
        <Card>
          <CardHeader><CardTitle>Buttons</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <Button>Primary</Button><Button variant="secondary">Secondary</Button><Button variant="tertiary">Join group</Button>
              <Button variant="destructive">Cancel session</Button><Button variant="success">Mark paid</Button>
              <Button variant="text">View all</Button><Button variant="back">Back</Button><Button disabled>Disabled</Button>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button size="sm">Small</Button><Button size="sm" variant="secondary">Small secondary</Button><Button size="icon" variant="ghost" aria-label="Add"><Plus /></Button>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Pills, badges and banners</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2">{TONES.map((t) => <BrandPill key={t} tone={t}>{t}</BrandPill>)}</div>
            <div className="flex flex-wrap gap-2">
              {(["default", "secondary", "teal", "success", "pending", "destructive", "notify", "outline"] as const).map((v) => <Badge key={v} variant={v}>{v}</Badge>)}
            </div>
            <Banner tone="info" action={<button>Review</button>}>2 booking requests are waiting on you</Banner>
            <Banner tone="success">Session created</Banner>
            <Banner tone="error" action={<button>Try again</button>}>That didn't save. Try again</Banner>
            <Placeholder><Plus />Add a session</Placeholder>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Form controls</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-2"><span className="text-label-xsm text-dark-300">Full name</span><Input placeholder="Jordan Patel" /></label>
            <label className="flex flex-col gap-2"><span className="text-label-xsm text-dark-300">Email (error)</span><Input aria-invalid defaultValue="jordan@" /><span className="text-caption text-error-700">Enter a full email address</span></label>
            <label className="flex flex-col gap-2"><span className="text-label-xsm text-dark-300">Read only</span><Input readOnly defaultValue="ava@example.com" /></label>
            <label className="flex flex-col gap-2"><span className="text-label-xsm text-dark-300">Disabled</span><Input disabled defaultValue="Not editable" /></label>
            <label className="flex flex-col gap-2 md:col-span-2"><span className="text-label-xsm text-dark-300">Bio</span><Textarea placeholder="Anything to remember" /></label>
            <div className="flex items-center gap-6">
              <label className="inline-flex items-center gap-2 text-body-m"><Checkbox defaultChecked />Email</label>
              <label className="inline-flex items-center gap-2 text-body-m"><Checkbox />App</label>
              <label className="inline-flex items-center gap-2 text-body-m"><Switch checked={on} onCheckedChange={setOn} />Session reminders</label>
            </div>
            <RadioGroup defaultValue="a" className="flex gap-6">
              <label className="inline-flex items-center gap-2 text-body-m"><RadioGroupItem value="a" />Through AthaNext</label>
              <label className="inline-flex items-center gap-2 text-body-m"><RadioGroupItem value="b" />Booking only</label>
            </RadioGroup>
            <Tabs defaultValue="week"><TabsList><TabsTrigger value="day">Day</TabsTrigger><TabsTrigger value="week">Week</TabsTrigger><TabsTrigger value="month">Month</TabsTrigger></TabsList></Tabs>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Table, avatar, overlays</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Table>
              <TableHeader><TableRow><TableHead>Athlete</TableHead><TableHead>Next session</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>
                <TableRow><TableCell className="flex items-center gap-2"><Avatar className="size-7"><AvatarFallback className="text-label-xsm">AP</AvatarFallback></Avatar>Ava Patel</TableCell><TableCell>Tue 5:00 PM</TableCell><TableCell><BrandPill tone="green">Paid</BrandPill></TableCell></TableRow>
                <TableRow><TableCell className="flex items-center gap-2"><Avatar className="size-7"><AvatarFallback className="text-label-xsm">EK</AvatarFallback></Avatar>Ethan Kim</TableCell><TableCell>Not booked</TableCell><TableCell><BrandPill tone="amber">Due</BrandPill></TableCell></TableRow>
              </TableBody>
            </Table>
            <div className="flex gap-3">
              <Dialog>
                <DialogTrigger asChild><Button variant="secondary">Open modal</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Cancel this session?</DialogTitle><DialogDescription>The family gets a credit back because it's more than 24 hours away.</DialogDescription></DialogHeader>
                  <DialogFooter><Button variant="secondary">Keep it</Button><Button variant="destructive">Cancel session</Button></DialogFooter>
                </DialogContent>
              </Dialog>
              <Button variant="secondary" onClick={() => toast({ title: "Session created" })}>Show toast</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
