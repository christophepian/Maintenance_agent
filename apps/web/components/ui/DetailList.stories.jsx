import { DetailList, DetailRow } from "./DetailList";
import Badge from "./Badge";

export default {
  title: "UI/DetailList",
  component: DetailList,
  subcomponents: { DetailRow },
  tags: ["autodocs"],
  parameters: { layout: "padded" },
};

export const Default = {
  render: () => (
    <div style={{ width: 320 }}>
      <DetailList>
        <DetailRow label="Status">
          <Badge variant="warning">Pending</Badge>
        </DetailRow>
        <DetailRow label="Amount" ddClassName="font-semibold">
          CHF 1,240
        </DetailRow>
        <DetailRow label="Due date">31 Jul 2026</DetailRow>
      </DetailList>
    </div>
  ),
};
