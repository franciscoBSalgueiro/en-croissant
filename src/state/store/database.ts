import type { GameQuery, PlayerQuery, TournamentQuery } from "@/bindings";
import type { SuccessDatabaseInfo } from "@/utils/db";
import { type Draft, produce } from "immer";
import { createStore, useStore } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export interface DatabaseViewStore {
  database?: SuccessDatabaseInfo;
  activeTab: "games" | "players" | "tournaments";
  games: {
    isFilterExpanded: boolean;
    query: GameQuery;
  };
  players: {
    query: PlayerQuery;
    selectedPlayer?: number;
    activeTab: "overview" | "openings";
  };
  tournaments: {
    query: TournamentQuery;
    selectedTournamet?: number;
    activeTab: "games" | "leaderboard";
  };

  setDatabase: (database: SuccessDatabaseInfo) => void;
  clearDatabase: () => void;
  setActiveTab: (mode: DatabaseViewStore["activeTab"]) => void;

  setGamesQuery: (filter: GameQuery) => void;
  toggleGamesOpenedSettings: () => void;

  setPlayersQuery: (filter: PlayerQuery) => void;
  setPlayersSelectedPlayer: (player?: number) => void;
  setPlayersActiveTab: (
    value: DatabaseViewStore["players"]["activeTab"],
  ) => void;

  setTournamentsQuery: (query: TournamentQuery) => void;
  setTournamentsSelectedTournamet: (tournament?: number) => void;
  setTournamentsActiveTab: (
    value: DatabaseViewStore["tournaments"]["activeTab"],
  ) => void;
}

const defaultGamesState: DatabaseViewStore["games"] = {
  isFilterExpanded: false,
  query: {
    player1: undefined,
    range1: [0, 3000],
    player2: undefined,
    range2: [0, 3000],
    sides: "WhiteBlack",
    outcome: undefined,
    options: {
      sort: "date",
      direction: "desc",
      pageSize: 25,
      page: 1,
      skipCount: false,
    },
  },
};

const defaultPlayersState: DatabaseViewStore["players"] = {
  activeTab: "overview",
  query: {
    name: undefined,
    range: undefined,
    options: {
      page: 1,
      pageSize: 25,
      sort: "name",
      direction: "desc",
      skipCount: false,
    },
  },
};

const defaultTournamentState: DatabaseViewStore["tournaments"] = {
  activeTab: "games",
  query: {
    name: "",
    options: {
      page: 1,
      pageSize: 25,
      sort: "name",
      direction: "desc",
      skipCount: false,
    },
  },
};

export const activeDatabaseViewStore = createStore<DatabaseViewStore>()(
  persist(
    (set) => ({
      activeTab: "games",
      games: defaultGamesState,
      players: defaultPlayersState,
      tournaments: defaultTournamentState,

      setDatabase: (database: SuccessDatabaseInfo) => {
        set(
          produce((state: Draft<DatabaseViewStore>) => {
            state.database = database;
            state.games = defaultGamesState;
            state.players = defaultPlayersState;
            state.tournaments = defaultTournamentState;
          }),
        );
      },
      clearDatabase: () => {
        set(
          produce((state: Draft<DatabaseViewStore>) => {
            state.database = undefined;
            state.games = defaultGamesState;
            state.players = defaultPlayersState;
            state.tournaments = defaultTournamentState;
            state.activeTab = "games";
          }),
        );
      },

      setActiveTab: (mode: DatabaseViewStore["activeTab"]) => {
        set(
          produce((state: Draft<DatabaseViewStore>) => {
            state.activeTab = mode;
          }),
        );
      },
      setGamesQuery: (query) => {
        set(
          produce((state: Draft<DatabaseViewStore>) => {
            state.games.query = query;
          }),
        );
      },
      toggleGamesOpenedSettings: () => {
        set(
          produce((state: Draft<DatabaseViewStore>) => {
            state.games.isFilterExpanded = !state.games.isFilterExpanded;
          }),
        );
      },

      setPlayersQuery: (query: PlayerQuery) => {
        set(
          produce((state: Draft<DatabaseViewStore>) => {
            state.players.query = query;
          }),
        );
      },
      setPlayersActiveTab: (
        value: DatabaseViewStore["players"]["activeTab"],
      ) => {
        set(
          produce((state: Draft<DatabaseViewStore>) => {
            state.players.activeTab = value;
          }),
        );
      },
      setPlayersSelectedPlayer: (player?: number) => {
        set(
          produce((state: Draft<DatabaseViewStore>) => {
            state.players.selectedPlayer = player;
          }),
        );
      },

      setTournamentsQuery: (query: TournamentQuery) => {
        set(
          produce((state: Draft<DatabaseViewStore>) => {
            state.tournaments.query = query;
          }),
        );
      },
      setTournamentsSelectedTournamet: (tournament?: number) => {
        set(
          produce((state: Draft<DatabaseViewStore>) => {
            state.tournaments.selectedTournamet = tournament;
          }),
        );
      },
      setTournamentsActiveTab: (
        value: DatabaseViewStore["tournaments"]["activeTab"],
      ) => {
        set(
          produce((state: Draft<DatabaseViewStore>) => {
            state.tournaments.activeTab = value;
          }),
        );
      },
    }),
    {
      name: "database-view",
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
);

export function useActiveDatabaseViewStore(): DatabaseViewStore;
export function useActiveDatabaseViewStore<T>(
  selector: (state: DatabaseViewStore) => T,
): T;
export function useActiveDatabaseViewStore<T>(
  selector?: (state: DatabaseViewStore) => T,
) {
  return useStore(activeDatabaseViewStore, selector!);
}
