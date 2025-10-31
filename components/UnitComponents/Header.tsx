"use client";

const Header = () => {
    return (
        <header className="sticky top-0 z-50 w-[calc(100%-40px)] bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 m-5 rounded-lg">
            <div className="container flex justify-center items-center py-4 px-6">
                <div className="flex flex-row justify-between items-center gap-2">
                    <span className="text-lg font-semibold text-foreground font-mono">
                        {"Stackbirds"}
                    </span>
                    <span className="text-muted-foreground">
                        {" |  Speak and there will be an AI-agent"}
                    </span>
                </div>
            </div>
        </header>
    );
};

export default Header;
