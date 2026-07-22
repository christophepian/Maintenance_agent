import DataTable from "./DataTable";
import StatusPill from "./StatusPill";

const rows = [
  { id: 1, unit: "3A", tenant: "Dupont SA", rent: "CHF 2,400", status: "Active" },
  { id: 2, unit: "3B", tenant: "Martin", rent: "CHF 1,950", status: "Late" },
  { id: 3, unit: "4A", tenant: "—", rent: "—", status: "Vacant" },
];
const pill = { Active: "success", Late: "destructive", Vacant: "muted" };

export default {
  title: "UI/DataTable",
  component: DataTable,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
};

export const Default = {
  render: () => (
    <div style={{ width: 620 }}>
      <DataTable
        columns={["Unit", "Tenant", "Rent", "Status"]}
        rows={rows}
        renderRow={(r) => (
          <tr key={r.id}>
            <td className="cell-bold">{r.unit}</td>
            <td>{r.tenant}</td>
            <td>{r.rent}</td>
            <td>
              <StatusPill variant={pill[r.status]}>{r.status}</StatusPill>
            </td>
          </tr>
        )}
      />
    </div>
  ),
};

export const Empty = {
  render: () => (
    <div style={{ width: 620 }}>
      <DataTable
        columns={["Unit", "Tenant"]}
        rows={[]}
        renderRow={() => null}
        empty="No units on this building yet."
      />
    </div>
  ),
};
