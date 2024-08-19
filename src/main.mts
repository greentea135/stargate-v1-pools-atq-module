import fetch from "node-fetch";
import { ContractTag, ITagService } from "atq-types";

const SUBGRAPH_URLS: Record<string, { decentralized: string }> = {
  // Ethereum Mainnet subgraph, by subgraphs.messari.eth (0x7e8f317a45d67e27e095436d2e0d47171e7c769f)
  "1": {
    decentralized:
      "https://gateway.thegraph.com/api/[api-key]/subgraphs/id/G1pPbbMjwCnFiyMherq8wqfMusZDriLMqvGBHLr2wS34",
  },
  // Optimism subgraph, by subgraphs.messari.eth (0x7e8f317a45d67e27e095436d2e0d47171e7c769f)
  "10": {
    decentralized:
      "https://gateway.thegraph.com/api/[api-key]/subgraphs/id/7NAF7ZtNtJiXkfCFkTSAyFbfLLfUFa55UgK5woxPxZ46",
  },
  // BSC subgraph, by subgraphs.messari.eth (0x7e8f317a45d67e27e095436d2e0d47171e7c769f)
  "56": {
    decentralized:
      "https://gateway.thegraph.com/api/[api-key]/subgraphs/id/6sRx6JNkjz66id39jCK3GMiVnPVuyuv2ntwQVpDzmjRF",
  },
  // Polygon subgraph, by subgraphs.messari.eth (0x7e8f317a45d67e27e095436d2e0d47171e7c769f)
  "137": {
    decentralized:
      "https://gateway.thegraph.com/api/[api-key]/subgraphs/id/SitmxEcPXXwo5cFK8Y2FSMZNZNQ4gXcGdWBDqo3A7K6",
  },
  // Fantom subgraph, by subgraphs.messari.eth (0x7e8f317a45d67e27e095436d2e0d47171e7c769f)
  "250": {
    decentralized:
      "https://gateway.thegraph.com/api/[api-key]/subgraphs/id/2pG7kUAfPhtGyy1StFLhFu8pwTR5kDsCJN9KZjWn9Lnk",
  },
  // Base subgraph, by subgraphs.messari.eth (0x7e8f317a45d67e27e095436d2e0d47171e7c769f)
  "8453": {
    decentralized:
      "https://gateway.thegraph.com/api/[api-key]/subgraphs/id/4amk8rvTHgxSobsFKsr5jheHsDzLcwyqc8vHhNC1xhGt",
  },
  // Arbitrum One subgraph, by subgraphs.messari.eth (0x7e8f317a45d67e27e095436d2e0d47171e7c769f)
  "42161": {
    decentralized:
      "https://gateway.thegraph.com/api/[api-key]/subgraphs/id/DWo7jrtpTtUM1buqiCUg7j7XUF568qNPBv7FwwDceuxm",
  },
  // Avalanche C-Chain subgraph, by subgraphs.messari.eth (0x7e8f317a45d67e27e095436d2e0d47171e7c769f)
  "43114": {
    decentralized:
      "https://gateway.thegraph.com/api/[api-key]/subgraphs/id/6XypMkQUovcohhVC2XeWgdXeDsBcnL9ynKdLXpXggoHd",
  },
};

// Define the Pool interface based on the new GraphQL query
interface Pool {
  id: string;
  name: string;
  symbol: string;
}

interface GraphQLData {
  pools: Pool[];
}

interface GraphQLResponse {
  data?: GraphQLData;
  errors?: { message: string }[]; // Assuming the API might return errors in this format
}

// Define headers for the query
const headers: Record<string, string> = {
  "Content-Type": "application/json",
  Accept: "application/json",
};

const GET_POOLS_QUERY = `
query MyQuery {
  pools(first: 100) {
    id
    name
    symbol
  }
}
`;

// Type guard for errors
function isError(e: unknown): e is Error {
  return (
    typeof e === "object" &&
    e !== null &&
    "message" in e &&
    typeof (e as Error).message === "string"
  );
}

// Function to check for invalid values
function containsInvalidValue(text: string): boolean {
  const containsHtml = /<[^>]*>/.test(text);
  const isEmpty = text.trim() === "";
  return isEmpty || containsHtml;
}

// Function to truncate strings
function truncateString(text: string, maxLength: number) {
  if (text.length > maxLength) {
    return text.substring(0, maxLength - 3) + "..."; // Subtract 3 for the ellipsis
  }
  return text;
}

// Function to fetch data from the GraphQL endpoint
async function fetchData(
  subgraphUrl: string
): Promise<Pool[]> {
  const response = await fetch(subgraphUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({
      query: GET_POOLS_QUERY,
    }),
  });

  if (!response.ok) {
    throw new Error(`HTTP error: ${response.status}`);
  }

  const result = (await response.json()) as GraphQLResponse;
  if (result.errors) {
    result.errors.forEach((error) => {
      console.error(`GraphQL error: ${error.message}`);
    });
    throw new Error("GraphQL errors occurred: see logs for details.");
  }

  if (!result.data || !result.data.pools) {
    throw new Error("No pools data found.");
  }

  return result.data.pools;
}

// Function to prepare the URL with the provided API key
function prepareUrl(chainId: string, apiKey: string): string {
  const urls = SUBGRAPH_URLS[chainId];
  if (!urls || isNaN(Number(chainId))) {
    const supportedChainIds = Object.keys(SUBGRAPH_URLS).join(", ");

    throw new Error(
      `Unsupported or invalid Chain ID provided: ${chainId}. Only the following values are accepted: ${supportedChainIds}`
    );
  }
  return urls.decentralized.replace("[api-key]", encodeURIComponent(apiKey));
}

// Function to transform pool data into ContractTag objects
function transformPoolsToTags(chainId: string, pools: Pool[]): ContractTag[] {
  const validPools: Pool[] = [];
  const rejectedNames: string[] = [];

  pools.forEach((pool) => {
    const nameInvalid = containsInvalidValue(pool.name);
    const symbolInvalid = containsInvalidValue(pool.symbol);

    if (nameInvalid || symbolInvalid) {
      // Reject pools where the name or symbol is empty or contains invalid content
      if (nameInvalid) {
        rejectedNames.push(`Pool: ${pool.id} rejected due to invalid name - Name: ${pool.name}`);
      }
      if (symbolInvalid) {
        rejectedNames.push(`Pool: ${pool.id} rejected due to invalid symbol - Symbol: ${pool.symbol}`);
      }
    } else {
      validPools.push(pool);
    }
  });

  if (rejectedNames.length > 0) {
    console.log("Rejected pools:", rejectedNames);
  }

  return validPools.map((pool) => {
    const maxSymbolsLength = 45;
    const truncatedSymbolsText = truncateString(pool.symbol, maxSymbolsLength);

    return {
      "Contract Address": `eip155:${chainId}:${pool.id}`,
      "Public Name Tag": `${truncatedSymbolsText} Pool`,
      "Project Name": "Stargate v1",
      "UI/Website Link": "https://stargate.finance",
      "Public Note": `Stargate v1's ${pool.name} pool contract.`,
    };
  });
}

// The main logic for this module
class TagService implements ITagService {
  // Using an arrow function for returnTags
  returnTags = async (
    chainId: string,
    apiKey: string
  ): Promise<ContractTag[]> => {
    let allTags: ContractTag[] = [];
    let isMore = true;

    const url = prepareUrl(chainId, apiKey);

    while (isMore) {
      try {
        const pools = await fetchData(url);
        allTags.push(...transformPoolsToTags(chainId, pools));

        // Determine if there's more data to fetch
        isMore = pools.length === 100; // Adjust the condition based on your data pagination
      } catch (error) {
        if (isError(error)) {
          console.error(`An error occurred: ${error.message}`);
          throw new Error(`Failed fetching data: ${error}`); // Propagate a new error with more context
        } else {
          console.error("An unknown error occurred.");
          throw new Error("An unknown error occurred during fetch operation."); // Throw with a generic error message if the error type is unknown
        }
      }
    }
    return allTags;
  };
}

// Creating an instance of TagService
const tagService = new TagService();

// Exporting the returnTags method directly
export const returnTags = tagService.returnTags;

