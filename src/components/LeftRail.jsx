import React from 'react';
import DomainShortcutRail from './DomainShortcutRail';

export default function LeftRail({
  railMode = 'domain',
  feedCategories,
  selectedFeedCategory,
  onSelectFeedCategory,
  domains,
  activeDomainId,
  activeShortcutId,
  onSelectDomain,
  onSelectShortcut,
  isMessagesMode,
  conversations,
  selectedConversationId,
  onSelectChatMember
}) {
  const currentActiveId = activeDomainId || activeShortcutId || 'tech';
  const handleSelectDomain = onSelectDomain || onSelectShortcut;

  return (
    <DomainShortcutRail
      railMode={railMode}
      feedCategories={feedCategories}
      selectedFeedCategory={selectedFeedCategory}
      onSelectFeedCategory={onSelectFeedCategory}
      domains={domains}
      activeDomainId={currentActiveId}
      onSelectDomain={handleSelectDomain}
      isMessagesMode={isMessagesMode}
      conversations={conversations}
      selectedConversationId={selectedConversationId}
      onSelectChatMember={onSelectChatMember}
    />
  );
}
