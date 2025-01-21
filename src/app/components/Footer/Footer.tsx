import { BsTelegram } from "react-icons/bs";
import { FaXTwitter } from "react-icons/fa6";
import { GoHome } from "react-icons/go";
import { IoMdBook } from "react-icons/io";

import { useTerms } from "@/app/context/Terms/TermsContext";

const iconLinks = [
  {
    name: "Website",
    url: "/",
    Icon: GoHome,
  },
  {
    name: "X",
    url: "https://x.com/_atlasprotocol",
    Icon: FaXTwitter,
  },
  // {
  //   name: "GitHub",
  //   url: "#",
  //   Icon: BsGithub,
  // },
  {
    name: "Telegram",
    url: "https://t.me/atlasprotocol",
    Icon: BsTelegram,
  },
  // {
  //   name: "LinkedIn",
  //   url: "https://www.linkedin.com/company/babylon-chain/",
  //   Icon: BsLinkedin,
  // },
  // {
  //   name: "Medium",
  //   url: "https://medium.com/babylonchain-io",
  //   Icon: BsMedium,
  // },
  {
    name: "Docs",
    url: "https://docs.atlasprotocol.com/",
    Icon: IoMdBook,
  },
  // {
  //   name: "Email",
  //   url: "mailto:contact@babylonchain.io",
  //   Icon: MdAlternateEmail,
  // },
  // {
  //   name: "Discord",
  //   url: "https://discord.com/invite/babylonglobal",
  //   Icon: BsDiscord,
  // },
];

interface FooterProps {}

export const Footer: React.FC<FooterProps> = () => {
  const { openTerms } = useTerms();

  return (
    <div className="flex flex-col items-center bg-footer-bg border-t border-footer-border">
      <div className="container mx-auto">
        {/* <div className="w-24">
        <div className="divider my-1" />
      </div>
      <div className="flex justify-center gap-8 p-2">
        <button
          onClick={openTerms}
          className="transition-colors hover:text-primary cursor-pointer btn btn-link no-underline text-base-content"
        >
          Terms of Use
        </button>
      </div> */}
        <div className="flex flex-wrap justify-center gap-6 px-4 py-4 md:flex-row md:p-6 md:py-4">
          {iconLinks.map(({ name, url, Icon }) => (
            <a
              key={name}
              className="w-8 h-8 p-2 bg-neutral-3 dark:bg-neutral-9 rounded-full justify-center items-center gap-2 inline-flex"
              href={url}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Icon size={20} title={name} />
            </a>
          ))}
        </div>
      </div>
    </div>
  );
};
