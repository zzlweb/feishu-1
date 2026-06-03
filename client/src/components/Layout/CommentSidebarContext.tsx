import { createContext, useContext } from 'react';

export const CommentSidebarTrackContext = createContext<HTMLElement | null>(null);

export function useCommentSidebarTrack() {
  return useContext(CommentSidebarTrackContext);
}
