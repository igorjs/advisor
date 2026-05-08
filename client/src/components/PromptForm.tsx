interface PromptFormProps {
  activePromptId: string | null;
  onPromptCreated: (publicId: string) => void;
}

export function PromptForm({ activePromptId: _activePromptId, onPromptCreated: _onPromptCreated }: PromptFormProps) {
  return <div>PromptForm placeholder</div>;
}
