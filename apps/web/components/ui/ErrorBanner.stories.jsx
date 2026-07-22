import ErrorBanner from "./ErrorBanner";

export default {
  title: "UI/ErrorBanner",
  component: ErrorBanner,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  argTypes: { error: { control: "text" } },
  args: { error: "Could not save the lease. Please try again." },
  decorators: [
    (Story) => (
      <div style={{ width: 460 }}>
        <Story />
      </div>
    ),
  ],
};

export const Playground = {};

export const Dismissible = {
  args: { onDismiss: () => {} },
};
