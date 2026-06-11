/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";

interface ArcadeCRTProps {
  children: React.ReactNode;
  enabled: boolean;
}

export function ArcadeCRT({ children, enabled }: ArcadeCRTProps) {
  return <div className="relative w-full h-full overflow-hidden">{children}</div>;
}
