import { useState } from "react";
import AppShell from "../components/AppShell";
import NotificationBell from "../components/NotificationBell";

export default function TestNotifications() {
  const [testResult, setTestResult] = useState("");
  const [loading, setLoading] = useState(false);

  const runTest = async (testName, testFn) => {
    setLoading(true);
    setTestResult(`Running ${testName}...`);
    try {
      const result = await testFn();
      setTestResult(`✅ ${testName}\n${JSON.stringify(result, null, 2)}`);
    } catch (err) {
      setTestResult(`❌ ${testName}\n${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const tests = [
    {
      name: "Create Request (triggers notification)",
      async fn() {
        const res = await fetch("/api/requests", {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "Authorization": `Bearer ${localStorage.getItem("authToken") || ""}`,
          },
          body: JSON.stringify({
            description: "Test notification trigger - broken dishwasher",
            category: "dishwasher",
            estimatedCost: 5000,
            contactPhone: "+41791234567",
          }),
        });
        const request = await res.json();
        
        if (!request.data?.id) {
          throw new Error(request.error?.message || "Failed to create request");
        }
        
        // Approve it to trigger notification
        const approveRes = await fetch(`/api/requests/approve?id=${request.data.id}`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${localStorage.getItem("authToken") || ""}`,
          },
        });
        return await approveRes.json();
      },
    },
    {
      name: "List All Notifications",
      async fn() {
        const res = await fetch("/api/notifications");
        return await res.json();
      },
    },
    {
      name: "Get Unread Count",
      async fn() {
        const res = await fetch("/api/notifications/unread-count");
        return await res.json();
      },
    },
    {
      name: "Filter Unread Only",
      async fn() {
        const res = await fetch("/api/notifications?isRead=false");
        return await res.json();
      },
    },
    {
      name: "Pagination (limit=2)",
      async fn() {
        const res = await fetch("/api/notifications?limit=2&offset=0");
        return await res.json();
      },
    },
  ];

  return (
    <AppShell role="MANAGER">
      <div className="max-w-6xl mx-auto p-6">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Notification System Test
          </h1>
          <NotificationBell />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Test Buttons */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Run Tests</h2>
            <div className="space-y-2">
              {tests.map((test) => (
                <button
                  key={test.name}
                  onClick={() => runTest(test.name, test.fn)}
                  disabled={loading}
                  className="w-full px-4 py-2 text-left bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  {test.name}
                </button>
              ))}
            </div>

            <div className="mt-6 pt-6 border-t border-gray-200">
              <h3 className="text-lg font-semibold mb-2">Manual Actions</h3>
              <button
                onClick={async () => {
                  const res = await fetch("/api/notifications/mark-all-read", {
                    method: "POST",
                  });
                  const data = await res.json();
                  setTestResult(`✅ Mark All Read\n${JSON.stringify(data, null, 2)}`);
                }}
                className="w-full px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                Mark All as Read
              </button>
            </div>
          </div>

          {/* Test Results */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Results</h2>
            <pre className="bg-gray-50 p-4 rounded text-sm overflow-auto max-h-96 whitespace-pre-wrap">
              {testResult || "Click a test button to see results..."}
            </pre>
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-2 text-blue-900">
            Testing Instructions
          </h2>
          <ol className="list-decimal list-inside space-y-2 text-blue-800">
            <li>Click "Create Request" to trigger a notification (auto-approved request creates notification)</li>
            <li>Check the notification bell (top right) - should show unread count</li>
            <li>Click the bell to open notification panel</li>
            <li>Test marking individual notifications as read (✓ button)</li>
            <li>Test deleting notifications (✕ button)</li>
            <li>Test "Mark all read" button</li>
            <li>Run other tests to verify API endpoints</li>
          </ol>
        </div>

        {/* API Endpoint Reference */}
        <div className="mt-8 bg-gray-50 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">API Endpoints</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <code className="block bg-white p-2 rounded mb-1">GET /api/notifications</code>
              <code className="block bg-white p-2 rounded mb-1">GET /api/notifications/unread-count</code>
              <code className="block bg-white p-2 rounded">POST /api/notifications/mark-all-read</code>
            </div>
            <div>
              <code className="block bg-white p-2 rounded mb-1">POST /api/notifications/:id/read</code>
              <code className="block bg-white p-2 rounded">DELETE /api/notifications/:id</code>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
