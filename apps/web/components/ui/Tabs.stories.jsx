import { Tabs, TabsList, TabsTrigger, TabsContent } from "./Tabs";

export default {
  title: "UI/Tabs",
  component: Tabs,
  parameters: { layout: "padded" },
  subcomponents: { TabsList, TabsTrigger, TabsContent },
};

const panel = { paddingTop: 16 };

/** A standard in-page tab strip. The active tab shows a brand underline. */
export const Default = {
  render: () => (
    <div style={{ width: 520 }}>
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="financials">Financials</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <p className="text-sm text-muted-dark" style={panel}>Building overview — units, occupancy, key metrics.</p>
        </TabsContent>
        <TabsContent value="financials">
          <p className="text-sm text-muted-dark" style={panel}>Financials — NOI, rent roll, reporting.</p>
        </TabsContent>
        <TabsContent value="documents">
          <p className="text-sm text-muted-dark" style={panel}>Documents — leases, statements, legal sources.</p>
        </TabsContent>
      </Tabs>
    </div>
  ),
};

/** Many tabs — the `.tab-strip` scrolls horizontally rather than wrapping. */
export const ManyTabs = {
  render: () => (
    <div style={{ width: 520 }}>
      <Tabs defaultValue="overview">
        <TabsList>
          {["Overview", "Financials", "Documents", "Tenants", "Maintenance", "Legal", "History"].map((t) => (
            <TabsTrigger key={t} value={t.toLowerCase()}>{t}</TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="overview">
          <p className="text-sm text-muted-dark" style={panel}>Scroll the strip → it never wraps.</p>
        </TabsContent>
      </Tabs>
    </div>
  ),
};
