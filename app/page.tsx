import EvidenceAgentApp from "../components/EvidenceAgentApp";
import { requireChatGPTUser } from "./chatgpt-auth";

export const dynamic = "force-dynamic";

export default async function Page() {
  const user = await requireChatGPTUser("/");
  return <EvidenceAgentApp viewer={{ displayName: user.displayName, email: user.email }} />;
}
