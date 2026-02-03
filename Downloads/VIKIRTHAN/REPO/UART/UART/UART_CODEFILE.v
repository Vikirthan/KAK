module uart_tx_simple (
    input        clk,
    input        reset,
    input        tx_start,
    input  [7:0] tx_data,
    output reg   tx,
    output reg   busy
);
    reg [3:0] bit_cnt;
    reg [9:0] frame;      // frame[0]=start, frame[8:1]=data[7:0] (LSB first), frame[9]=stop

    // 1 UART bit = 4 clk cycles (for RX mid-bit sampling)
    localparam BAUD_DIV = 4;
    reg [1:0] baud_cnt;

    always @(posedge clk or posedge reset) begin
        if (reset) begin
            tx      <= 1'b1;              // line idle = 1
            busy    <= 1'b0;
            bit_cnt <= 4'd0;
            frame   <= 10'b11_1111_1111;
            baud_cnt<= 2'd0;
        end else begin
            if (!busy) begin
                baud_cnt <= 2'd0;
              
                if (tx_start) begin
                   
                    frame   <= {1'b1, tx_data, 1'b0};
                    bit_cnt <= 4'd0;
                    busy    <= 1'b1;
                    tx      <= 1'b0;       // drive start bit immediately
                end
            end else begin
                // generate bit timing
                if (baud_cnt == BAUD_DIV-1) begin
                    baud_cnt <= 2'd0;
                    bit_cnt  <= bit_cnt + 1'b1;

                    if (bit_cnt < 4'd9) begin
                        tx <= frame[bit_cnt+1];   // next bit
                    end else begin
                        busy <= 1'b0;
                        tx   <= 1'b1;            // back to idle after stop
                    end
                end else begin
                    baud_cnt <= baud_cnt + 1'b1;
                end
            end
        end
    end
endmodule

module uart_rx_simple (
    input        clk,
    input        reset,
    input        rx,
    output reg [7:0] rx_data,
    output reg       rx_done
);
    // must match TX BAUD_DIV
    localparam BAUD_DIV = 4;

    reg [3:0] bit_cnt;
    reg [1:0] baud_cnt;
    reg       receiving;

    always @(posedge clk or posedge reset) begin
        if (reset) begin
            bit_cnt   <= 4'd0;
            baud_cnt  <= 2'd0;
            rx_data   <= 8'd0;
            rx_done   <= 1'b0;
            receiving <= 1'b0;
        end else begin
            rx_done <= 1'b0;

            if (!receiving) begin
                // wait for start bit (line goes 1 -> 0)
                if (rx == 1'b0) begin
                    receiving <= 1'b1;
                    bit_cnt   <= 4'd0;
                    baud_cnt  <= BAUD_DIV/2; // half bit to reach middle of start bit
                end
            end else begin
                if (baud_cnt == BAUD_DIV-1) begin
                    baud_cnt <= 2'd0;
                    bit_cnt  <= bit_cnt + 1'b1;

                   
                    if (bit_cnt >= 4'd1 && bit_cnt <= 4'd8) begin
                        // first sampled data bit -> bit0, last -> bit7
                        rx_data[bit_cnt-1] <= rx;
                    end

                    // bit_cnt = 9 is stop bit; finish frame
                    if (bit_cnt == 4'd9) begin
                        rx_done   <= 1'b1;     // full byte ready
                        receiving <= 1'b0;
                    end
                end else begin
                    baud_cnt <= baud_cnt + 1'b1;
                end
            end
        end
    end
endmodule

module uart_simple_tb;

    reg clk;
    reg reset;
    reg tx_start;
    reg [7:0] tx_data;
    wire tx;
    wire busy;
    wire [7:0] rx_data;
    wire rx_done;

    uart_tx_simple uut_tx (
        .clk(clk),
        .reset(reset),
        .tx_start(tx_start),
        .tx_data(tx_data),
        .tx(tx),
        .busy(busy)
    );

    uart_rx_simple uut_rx (
        .clk(clk),
        .reset(reset),
        .rx(tx),          // TX -> RX loopback
        .rx_data(rx_data),
        .rx_done(rx_done)
    );

initial begin
        clk = 0;
        forever #10 clk = ~clk;   // 20 ns period
    end

    initial begin
        reset    = 1;
        tx_start = 0;
        tx_data  = 8'h00;

        #100;
        reset = 0;

        // send 10110110
        #80;                       // wait some cycles
        tx_data  = 8'b10110110;
        tx_start = 1;
        #20;
        tx_start = 0;

        wait (!busy);
        #400;

        // send another pattern
        tx_data  = 8'h3C;
        tx_start = 1;
        #20;
        tx_start = 0;

        wait (!busy);
        #800;
        $stop;
    end

    always @(posedge clk) begin
        if (rx_done)
            $display("t=%0t  TX=%b  RX=%b", $time, tx_data, rx_data);
    end

endmodule
