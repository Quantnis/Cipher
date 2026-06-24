from app.services.repository import repo


def main() -> None:
    repo.reset()
    print("Seeded demo repository: 3 sources, 5 jobs, 40 pages, 30 alerts, 120 entities, 5 cases.")


if __name__ == "__main__":
    main()
