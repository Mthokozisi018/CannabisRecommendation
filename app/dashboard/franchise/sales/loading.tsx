"use client";

import { useContext } from "react";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import { FranchiseSalesLoadingContext } from "@/components/franchise/FranchiseSalesNavigation";

export default function FranchiseSalesLoading() {
  const managed = useContext(FranchiseSalesLoadingContext);
  return <LoadingOverlay active={!managed} label="Loading Franchise Sales Performance" />;
}
