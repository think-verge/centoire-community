import { useParams } from "react-router-dom";
import { PostPanel } from "../../components/PostPanel";

export function PostDetailPage() {
  const { slug } = useParams();
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <PostPanel slug={slug ?? ""} />
    </div>
  );
}
