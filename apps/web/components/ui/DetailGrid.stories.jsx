import { DetailGrid, DetailItem } from "./DetailGrid";
import Badge from "./Badge";

export default {
  title: "UI/DetailGrid",
  component: DetailGrid,
  subcomponents: { DetailItem },
  tags: ["autodocs"],
  parameters: { layout: "padded" },
};

export const Default = {
  render: () => (
    <div style={{ width: 620 }}>
      <DetailGrid>
        <DetailItem label="Status">
          <Badge variant="success">Occupied</Badge>
        </DetailItem>
        <DetailItem label="Units">24</DetailItem>
        <DetailItem label="Monthly rent" valueClassName="font-semibold">
          CHF 34,300
        </DetailItem>
        <DetailItem label="Year built">1974</DetailItem>
      </DetailGrid>
    </div>
  ),
};
