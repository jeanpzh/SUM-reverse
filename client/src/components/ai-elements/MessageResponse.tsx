import { NormativeMarkdown } from './NormativeMarkdown'

export function MessageResponse({ children }: { children: string }) {
  return <NormativeMarkdown>{children}</NormativeMarkdown>
}
