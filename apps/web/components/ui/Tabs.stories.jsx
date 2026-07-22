import { Tabs, TabsList, TabsTrigger, TabsContent } from "./Tabs";

export default {
  title: "UI/Tabs",
  component: Tabs,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
};

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
          <p className="text-sm text-muted-dark" style={{ paddingTop: 16 }}>
            Building overview — units, occupancy, and key metrics.
          </p>
        </TabsContent>
        <TabsContent value="financials">
          <p className="text-sm text-muted-dark" style={{ paddingTop: 16 }}>
            Financials — NOI, rent roll, and reporting.
          </p>
        </TabsContent>
        <TabsContent value="documents">
          <p className="text-sm text-muted-dark" style={{ paddingTop: 16 }}>
            Documents — leases, statements, and legal sources.
          </p>
        </TabsContent>
      </Tabs>
    </div>
  ),
};
