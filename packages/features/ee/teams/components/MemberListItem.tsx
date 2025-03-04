import classNames from "classnames";
import { signIn } from "next-auth/react";

import { useState } from "react";

import { WEBAPP_URL } from "@calcom/lib/constants";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { MembershipRole } from "@calcom/prisma/enums";
import { teamMetadataSchema } from "@calcom/prisma/zod-utils";
import type { RouterOutputs } from "@calcom/trpc/react";
import { trpc } from "@calcom/trpc/react";
import useMeQuery from "@calcom/trpc/react/hooks/useMeQuery";
import {
  Avatar,
  Button,
  ButtonGroup,
  ConfirmationDialogContent,
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  Dropdown,
  DropdownItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  showToast,
  Tooltip,
} from "@calcom/ui";
import { ExternalLink, MoreHorizontal, Edit2, Lock, UserX } from "@calcom/ui/components/icon";

import MemberChangeRoleModal from "./MemberChangeRoleModal";
import TeamAvailabilityModal from "./TeamAvailabilityModal";
import TeamPill, { TeamRole } from "./TeamPill";

interface Props {
  team: RouterOutputs["viewer"]["teams"]["get"];
  member: RouterOutputs["viewer"]["teams"]["get"]["members"][number];
}

/** TODO: Migrate the one in apps/web to tRPC package */
const useCurrentUserId = () => {
  const query = useMeQuery();
  const user = query.data;
  return user?.id;
};

const checkIsOrg = (team: Props["team"]) => {
  const metadata = teamMetadataSchema.safeParse(team.metadata);
  if (metadata.success && metadata.data?.isOrganization) return true;
  return false;
};

export default function MemberListItem(props: Props) {
  const { t } = useLocale();

  const utils = trpc.useContext();
  const [showChangeMemberRoleModal, setShowChangeMemberRoleModal] = useState(false);
  const [showTeamAvailabilityModal, setShowTeamAvailabilityModal] = useState(false);
  const [showImpersonateModal, setShowImpersonateModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const removeMemberMutation = trpc.viewer.teams.removeMember.useMutation({
    async onSuccess() {
      await utils.viewer.teams.get.invalidate();
      await utils.viewer.eventTypes.invalidate();
      await utils.viewer.organizations.listMembers.invalidate();
      showToast(t("success"), "success");
    },
    async onError(err) {
      showToast(err.message, "error");
    },
  });

  const ownersInTeam = () => {
    const { members } = props.team;
    const owners = members.filter((member) => member["role"] === MembershipRole.OWNER && member["accepted"]);
    return owners.length;
  };

  const currentUserId = useCurrentUserId();

  const name =
    props.member.name ||
    (() => {
      const emailName = props.member.email.split("@")[0];
      return emailName.charAt(0).toUpperCase() + emailName.slice(1);
    })();

  const removeMember = () =>
    removeMemberMutation.mutate({
      teamId: props.team?.id,
      memberId: props.member.id,
      isOrg: checkIsOrg(props.team),
    });

  const editMode =
    (props.team.membership.role === MembershipRole.OWNER &&
      (props.member.role !== MembershipRole.OWNER ||
        ownersInTeam() > 1 ||
        props.member.id !== currentUserId)) ||
    (props.team.membership.role === MembershipRole.ADMIN && props.member.role !== MembershipRole.OWNER);
  const impersonationMode =
    editMode &&
    !props.member.disableImpersonation &&
    props.member.accepted &&
    process.env.NEXT_PUBLIC_TEAM_IMPERSONATION === "true";

  const urlWithoutProtocol = WEBAPP_URL.replace(/^https?:\/\//, "");
  const bookingLink = !!props.member.username && `${urlWithoutProtocol}/${props.member.username}`;

  return (
    <li className="divide-subtle divide-y px-5">
      <div className="my-4 flex justify-between">
        <div className="flex w-full flex-col justify-between sm:flex-row">
          <div className="flex">
            <Avatar
              size="sm"
              imageSrc={WEBAPP_URL + "/" + props.member.username + "/avatar.png"}
              alt={name || ""}
              className="h-10 w-10 rounded-full"
            />

            <div className="ms-3 inline-block">
              <div className="mb-1 flex">
                <span className="text-default mr-1 text-sm font-bold leading-4">{name}</span>

                {!props.member.accepted && <TeamPill color="orange" text={t("pending")} />}
                {props.member.role && <TeamRole role={props.member.role} />}
              </div>
              <div className="text-default flex items-center">
                <span className=" block text-sm" data-testid="member-email" data-email={props.member.email}>
                  {props.member.email}
                </span>
                {bookingLink && (
                  <>
                    <span className="text-default mx-2 block">•</span>
                    <a
                      target="_blank"
                      href={`${WEBAPP_URL}/${props.member.username}`}
                      className="text-default block text-sm">
                      {bookingLink}
                    </a>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
        {props.team.membership.accepted && (
          <div className="flex items-center justify-center">
            <ButtonGroup combined containerProps={{ className: "border-default hidden md:flex" }}>
              {/* TODO: bring availability back. right now its ugly and broken
               <Tooltip
                content={
                  props.member.accepted
                    ? t("team_view_user_availability")
                    : t("team_view_user_availability_disabled")
                }>
                <Button
                  disabled={!props.member.accepted}
                  onClick={() => (props.member.accepted ? setShowTeamAvailabilityModal(true) : null)}
                  color="secondary"
                  variant="icon"
                  StartIcon={Clock}
                />
              </Tooltip> */}
              <Tooltip content={t("view_public_page")}>
                <Button
                  target="_blank"
                  href={"/" + props.member.username}
                  color="secondary"
                  className={classNames(!editMode ? "rounded-r-md" : "")}
                  variant="icon"
                  StartIcon={ExternalLink}
                  disabled={!props.member.accepted}
                />
              </Tooltip>
              {editMode && (
                <Dropdown>
                  <DropdownMenuTrigger asChild>
                    <Button
                      className="radix-state-open:rounded-r-md"
                      color="secondary"
                      variant="icon"
                      StartIcon={MoreHorizontal}
                    />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem>
                      <DropdownItem
                        type="button"
                        onClick={() => setShowChangeMemberRoleModal(true)}
                        StartIcon={Edit2}>
                        {t("edit")}
                      </DropdownItem>
                    </DropdownMenuItem>
                    {impersonationMode && (
                      <>
                        <DropdownMenuItem>
                          <DropdownItem
                            type="button"
                            onClick={() => setShowImpersonateModal(true)}
                            StartIcon={Lock}>
                            {t("impersonate")}
                          </DropdownItem>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                      </>
                    )}
                    <DropdownMenuItem>
                      <DropdownItem
                        type="button"
                        onClick={() => setShowDeleteModal(true)}
                        color="destructive"
                        StartIcon={UserX}>
                        {t("remove")}
                      </DropdownItem>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </Dropdown>
              )}
            </ButtonGroup>
            <div className="flex md:hidden">
              <Dropdown>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="icon" color="minimal" StartIcon={MoreHorizontal} />
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem className="outline-none">
                    <DropdownItem
                      disabled={!props.member.accepted}
                      href={!props.member.accepted?undefined : "/" + props.member.username}
                      target="_blank"
                      type="button"
                      StartIcon={ExternalLink}>
                      {t("view_public_page")}
                    </DropdownItem>
                  </DropdownMenuItem>
                  {editMode && (
                    <>
                      <DropdownMenuItem>
                        <DropdownItem
                          type="button"
                          onClick={() => setShowChangeMemberRoleModal(true)}
                          StartIcon={Edit2}>
                          {t("edit")}
                        </DropdownItem>
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <DropdownItem
                          type="button"
                          color="destructive"
                          onClick={() => setShowDeleteModal(true)}
                          StartIcon={UserX}>
                          {t("remove")}
                        </DropdownItem>
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </Dropdown>
            </div>
          </div>
        )}
      </div>

      {editMode && (
        <Dialog open={showDeleteModal} onOpenChange={() => setShowDeleteModal(false)}>
          <ConfirmationDialogContent
            variety="danger"
            title={t("remove_member")}
            confirmBtnText={t("confirm_remove_member")}
            onConfirm={removeMember}>
            {t("remove_member_confirmation_message")}
          </ConfirmationDialogContent>
        </Dialog>
      )}

      {showImpersonateModal && props.member.username && (
        <Dialog open={showImpersonateModal} onOpenChange={() => setShowImpersonateModal(false)}>
          <DialogContent type="creation" title={t("impersonate")} description={t("impersonation_user_tip")}>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await signIn("impersonation-auth", {
                  username: props.member.username || props.member.email,
                  teamId: props.team.id,
                });
                setShowImpersonateModal(false);
              }}>
              <DialogFooter>
                <DialogClose color="secondary">{t("cancel")}</DialogClose>
                <Button color="primary" type="submit">
                  {t("impersonate")}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {showChangeMemberRoleModal && (
        <MemberChangeRoleModal
          isOpen={showChangeMemberRoleModal}
          currentMember={props.team.membership.role}
          teamId={props.team?.id}
          memberId={props.member.id}
          initialRole={props.member.role as MembershipRole}
          onExit={() => setShowChangeMemberRoleModal(false)}
        />
      )}
      {showTeamAvailabilityModal && (
        <Dialog open={showTeamAvailabilityModal} onOpenChange={() => setShowTeamAvailabilityModal(false)}>
          <DialogContent type="creation" size="md">
            <TeamAvailabilityModal team={props.team} member={props.member} />
            <DialogFooter>
              <Button onClick={() => setShowTeamAvailabilityModal(false)}>{t("done")}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </li>
  );
}
