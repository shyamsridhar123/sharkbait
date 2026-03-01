/**
 * Logo Component - Displays the Sharkbait ASCII art logo
 */

import React from "react";
import { Box, Text } from "ink";
import { colors } from "./theme";

// Shark ASCII art - embedded directly so it works in bundled/npm installs
export const SHARK_LOGO = `
                              +.+++.
                            ## ....-### -
                           +  ###++++-#++-
                           - ##+-++--+-+--.
                             #++++-+-------..
                           - -#+-----++-.....
                           ##-.----+-.  ###########
                           #..-++--. +#####+.   .. .
                       ####..--+--..##. ...-+####++-.
                     #  . .-.--+-. ## .+++++++++++-++..
                    # ##+### -+--.## .--+++++++++++++-+
                   + .#+-###.--+.-# -+--------+++++-...
                     -#.-###.--- #+.+---... ...-+++-.###
                  ###.--+##-.++.## ---...####...-+++- .###
    #           .. ##- --## -#.-#.-+...##   ###.-++++   ##+
   #- ###+--+#---#- # +++-..#-.+# +-.-##.    ##-.-+++#####.
  ## ##---+##+--++#+.+-+-+--+-.+#.+-.####--.###+.-+++.###+.
  # .#+++----++-+-++.#..+-.---.#+---..########..-++++-....-+##-.
  #. #++##++--+----+--#.#-----.#+-----........-+++++++++++-----+#.
  #- #++-+++++++--+++.# -#..--.+#.--------....--+++++--.--.#++++#+
  +# ##---+++++++---+.+#.-#+---.#+..-------++--.....--++-.++--++#.
   # .##+++--++-++-+-....++- ....+#...----++--++####++..-##++++##
    #  ###+++-++-++..  .    +##..+.+#-......------....+#+++++##-
     #   #####+++.           ## ++--+.  ..      .-###########-
       #.    .+.                ..- +.               .###-
           #-.                +   #
`.trimEnd();

interface LogoProps {
  variant?: "full" | "medium" | "compact" | "inline";
  version?: string;
}

export function Logo({ variant = "full", version = "0.0.0" }: LogoProps): React.JSX.Element {
  const logoText = variant === "inline" ? "" : SHARK_LOGO;

  return (
    <Box flexDirection="column" alignItems="center">
      <Text color={colors.primary}>{logoText}</Text>
      {variant !== "inline" && (
        <Box marginTop={0}>
          <Text bold color={colors.primary}>SHARKBAIT</Text>
          <Text color={colors.textMuted}> v{version}</Text>
        </Box>
      )}
    </Box>
  );
}

// Inline logo for headers
export function InlineLogo(): React.JSX.Element {
  return (
    <Text>
      <Text color={colors.primary}>🦈</Text>
      <Text bold color={colors.primary}> sharkbait</Text>
    </Text>
  );
}
